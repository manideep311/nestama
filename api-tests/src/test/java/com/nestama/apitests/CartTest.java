package com.nestama.apitests;

import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.nestama.apitests.support.Api;
import com.nestama.apitests.support.Catalog;
import com.nestama.apitests.support.Session;
import io.restassured.response.Response;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@DisplayName("Cart: guest cart, quantities, totals and coupons")
class CartTest {

    /** Prices are integers in paise (₹1 = 100). WELCOME10 is 10% off, capped at ₹300. */
    private static final int WELCOME10_CAP_PAISE = 30_000;

    @Test
    @DisplayName("a new guest starts with an empty cart and zero total")
    void newGuestCartIsEmpty() {
        Session.guest().request()
                .when().get(Api.V1 + "/cart")
                .then()
                .statusCode(200)
                .body(matchesJsonSchemaInClasspath("schemas/cart.json"))
                .body("lines", hasSize(0))
                .body("summary.total", equalTo(0))
                .body("summary.itemCount", equalTo(0));
    }

    @Test
    @DisplayName("adding an item returns 201 and line total = unit price x quantity")
    void addItemCalculatesTotals() {
        Session guest = Session.guest();
        Response cart = guest.addToCart(Catalog.inStockVariantId(), 2)
                .then()
                .statusCode(201)
                .body(matchesJsonSchemaInClasspath("schemas/cart.json"))
                .body("lines", hasSize(1))
                .body("lines[0].quantity", equalTo(2))
                .body("summary.itemCount", equalTo(2))
                .extract().response();

        int unitPrice = cart.path("lines[0].unitPrice");
        int lineTotal = cart.path("lines[0].lineTotal");
        assertEquals(unitPrice * 2, lineTotal, "line total");
        assertSummaryAddsUp(cart);
    }

    @Test
    @DisplayName("changing the quantity updates the line total")
    void updateQuantity() {
        Session guest = Session.guest();
        String lineId = guest.addToCart(Catalog.inStockVariantId(), 1).then().statusCode(201).extract().path("lines[0].id");

        Response cart = guest.request()
                .body(Map.of("quantity", 3))
                .when().patch(Api.V1 + "/cart/items/" + lineId)
                .then()
                .statusCode(200)
                .body("lines[0].quantity", equalTo(3))
                .extract().response();
        assertEquals((int) cart.path("lines[0].unitPrice") * 3, (int) cart.path("lines[0].lineTotal"));
        assertSummaryAddsUp(cart);
    }

    @Test
    @DisplayName("setting the quantity to 0 removes the line")
    void quantityZeroRemovesLine() {
        Session guest = Session.guest();
        String lineId = guest.addToCart(Catalog.inStockVariantId(), 1).then().statusCode(201).extract().path("lines[0].id");

        guest.request()
                .body(Map.of("quantity", 0))
                .when().patch(Api.V1 + "/cart/items/" + lineId)
                .then()
                .statusCode(200)
                .body("lines", hasSize(0))
                .body("summary.total", equalTo(0));
    }

    @ParameterizedTest(name = "quantity {0} is rejected")
    @ValueSource(ints = {0, -1, 21})
    @DisplayName("adding with a quantity outside 1–20 is rejected")
    void addRejectsBadQuantities(int quantity) {
        Session.guest().addToCart(Catalog.inStockVariantId(), quantity)
                .then()
                .statusCode(400)
                .body("error.code", equalTo("VALIDATION_ERROR"))
                .body("error.details.fieldErrors", hasKey("quantity"));
    }

    @Test
    @DisplayName("removing a line empties the cart")
    void removeLine() {
        Session guest = Session.guest();
        String lineId = guest.addToCart(Catalog.inStockVariantId(), 1).then().statusCode(201).extract().path("lines[0].id");

        guest.request()
                .when().delete(Api.V1 + "/cart/items/" + lineId)
                .then()
                .statusCode(200)
                .body("lines", hasSize(0));
    }

    @Test
    @DisplayName("an unknown variant cannot be added")
    void unknownVariantIsRejected() {
        Session.guest().addToCart("no-such-variant", 1)
                .then()
                .statusCode(404)
                .body("error.code", equalTo("VARIANT_NOT_FOUND"));
    }

    @Test
    @DisplayName("two guests never see each other's cart")
    void guestCartsAreIsolated() {
        Session alice = Session.guest();
        alice.addToCart(Catalog.inStockVariantId(), 1).then().statusCode(201);

        Session.guest().request()
                .when().get(Api.V1 + "/cart")
                .then()
                .statusCode(200)
                .body("lines", hasSize(0));
    }

    @Test
    @DisplayName("WELCOME10 takes 10% off (capped at ₹300), is case-insensitive and can be removed")
    void welcomeCouponDiscount() {
        Session customer = Session.newCustomer("coupon");
        customer.addToCart(Catalog.inStockVariantId(), 2).then().statusCode(201);

        Response cart = customer.request()
                .body(Map.of("code", "welcome10"))
                .when().post(Api.V1 + "/cart/coupon")
                .then()
                .statusCode(200)
                .body("summary.couponCode", equalTo("WELCOME10"))
                .extract().response();

        int subtotal = cart.path("summary.subtotal");
        int discount = cart.path("summary.couponDiscount");
        long tenPercent = Math.round(subtotal * 10 / 100.0);
        assertEquals((int) Math.min(tenPercent, WELCOME10_CAP_PAISE), discount, "coupon discount");
        assertSummaryAddsUp(cart);

        customer.request()
                .when().delete(Api.V1 + "/cart/coupon")
                .then()
                .statusCode(200)
                .body("summary.couponCode", nullValue())
                .body("summary.couponDiscount", equalTo(0));
    }

    @Test
    @DisplayName("an unknown coupon code is refused with a reason")
    void unknownCouponIsRefused() {
        Session customer = Session.newCustomer("badcoupon");
        customer.addToCart(Catalog.inStockVariantId(), 1).then().statusCode(201);

        customer.request()
                .body(Map.of("code", "FREEMONEY"))
                .when().post(Api.V1 + "/cart/coupon")
                .then()
                .statusCode(422)
                .body("error.code", equalTo("COUPON_INVALID"))
                .body("error.details.reason", equalTo("NOT_FOUND"));
    }

    /** subtotal = sum of line totals, and total = subtotal - coupon discount + shipping. */
    private static void assertSummaryAddsUp(Response cart) {
        List<Integer> lineTotals = cart.path("lines.lineTotal");
        int subtotal = cart.path("summary.subtotal");
        int discount = cart.path("summary.couponDiscount");
        int shipping = cart.path("summary.shipping");
        int total = cart.path("summary.total");
        assertEquals(lineTotals.stream().mapToInt(Integer::intValue).sum(), subtotal, "subtotal");
        assertEquals(subtotal - discount + shipping, total, "total");
        assertTrue(total >= 0, "total can't be negative");
    }
}
