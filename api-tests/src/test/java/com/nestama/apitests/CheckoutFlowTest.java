package com.nestama.apitests;

import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.notNullValue;

import com.nestama.apitests.support.Api;
import com.nestama.apitests.support.Catalog;
import com.nestama.apitests.support.Session;
import io.restassured.response.Response;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * End-to-end purchase through the demo payment gateway: checkout creates an order, the gateway
 * authorizes and signs the payment, and verify checks the HMAC signature before confirming.
 */
@DisplayName("Checkout: order, demo payment and signature verification")
class CheckoutFlowTest {

    @Test
    @DisplayName("a full purchase confirms the order, lists it in the account and empties the cart")
    void fullPurchaseFlow() {
        Session customer = Session.newCustomer("buyer");
        String addressId = customer.createAddress();
        customer.addToCart(Catalog.inStockVariantId(), 1).then().statusCode(201);
        int cartTotal = customer.request().get(Api.V1 + "/cart").then().extract().path("summary.total");

        Response order = customer.request()
                .body(Map.of("addressId", addressId))
                .when().post(Api.V1 + "/checkout/orders")
                .then()
                .statusCode(201)
                .body(matchesJsonSchemaInClasspath("schemas/checkout-order.json"))
                .body("amount", equalTo(cartTotal))
                .extract().response();
        String orderId = order.path("orderId");
        String gatewayOrderId = order.path("gatewayOrderId");

        Response payment = authorize(customer, gatewayOrderId, "UPI", "success")
                .then()
                .statusCode(200)
                .body("status", equalTo("authorized"))
                .body("signature", matchesPattern("^[0-9a-f]{64}$"))
                .extract().response();

        customer.request()
                .body(verifyBody(orderId, gatewayOrderId, payment.path("gatewayPaymentId"), payment.path("signature")))
                .when().post(Api.V1 + "/payments/verify")
                .then()
                .statusCode(200)
                .body("id", equalTo(orderId))
                .body("status", equalTo("CONFIRMED"))
                .body("total", equalTo(cartTotal))
                .body("paidAt", notNullValue());

        customer.request()
                .when().get(Api.V1 + "/account/orders")
                .then()
                .statusCode(200)
                .body("items.id", hasItem(orderId));

        customer.request()
                .when().get(Api.V1 + "/cart")
                .then()
                .statusCode(200)
                .body("lines", hasSize(0));
    }

    @Test
    @DisplayName("a tampered payment signature is rejected and the order stays unpaid")
    void tamperedSignatureIsRejected() {
        Session customer = Session.newCustomer("tamper");
        Response order = placeOrder(customer);
        String orderId = order.path("orderId");
        String gatewayOrderId = order.path("gatewayOrderId");

        Response payment = authorize(customer, gatewayOrderId, "CARD", "success").then().statusCode(200).extract().response();
        String realSignature = payment.path("signature");
        String forged = (realSignature.charAt(0) == 'a' ? "b" : "a") + realSignature.substring(1);

        customer.request()
                .body(verifyBody(orderId, gatewayOrderId, payment.path("gatewayPaymentId"), forged))
                .when().post(Api.V1 + "/payments/verify")
                .then()
                .statusCode(400)
                .body("error.code", equalTo("SIGNATURE_INVALID"));

        customer.request()
                .when().get(Api.V1 + "/orders/" + orderId)
                .then()
                .statusCode(200)
                .body("status", equalTo("PENDING_PAYMENT"));
    }

    @Test
    @DisplayName("a declined payment closes the order and keeps the items in the cart")
    void declinedPaymentClosesOrder() {
        Session customer = Session.newCustomer("declined");
        Response order = placeOrder(customer);
        String orderId = order.path("orderId");

        authorize(customer, order.path("gatewayOrderId"), "CARD", "failure")
                .then()
                .statusCode(200)
                .body("status", equalTo("failed"))
                .body("reason", notNullValue());

        customer.request()
                .when().get(Api.V1 + "/orders/" + orderId)
                .then()
                .statusCode(200)
                .body("status", equalTo("PAYMENT_FAILED"))
                .body("canPay", equalTo(false));

        customer.request()
                .when().get(Api.V1 + "/cart")
                .then()
                .statusCode(200)
                .body("summary.itemCount", equalTo(1));
    }

    @Test
    @DisplayName("checking out with an empty cart is refused")
    void emptyCartCannotCheckOut() {
        Session customer = Session.newCustomer("empty");
        String addressId = customer.createAddress();

        customer.request()
                .body(Map.of("addressId", addressId))
                .when().post(Api.V1 + "/checkout/orders")
                .then()
                .statusCode(422)
                .body("error.code", equalTo("CART_EMPTY"));
    }

    @Test
    @DisplayName("checkout rejects extra fields in the request body")
    void checkoutRejectsUnknownFields() {
        Session customer = Session.newCustomer("strict");
        String addressId = customer.createAddress();
        customer.addToCart(Catalog.inStockVariantId(), 1).then().statusCode(201);

        customer.request()
                .body(Map.of("addressId", addressId, "amount", 1))
                .when().post(Api.V1 + "/checkout/orders")
                .then()
                .statusCode(400)
                .body("error.code", equalTo("VALIDATION_ERROR"));
    }

    private static Response placeOrder(Session customer) {
        String addressId = customer.createAddress();
        customer.addToCart(Catalog.inStockVariantId(), 1).then().statusCode(201);
        return customer.request()
                .body(Map.of("addressId", addressId))
                .post(Api.V1 + "/checkout/orders")
                .then()
                .statusCode(201)
                .extract().response();
    }

    private static Response authorize(Session customer, String gatewayOrderId, String method, String outcome) {
        return customer.request()
                .body(Map.of("gatewayOrderId", gatewayOrderId, "method", method, "outcome", outcome))
                .post(Api.V1 + "/payments/demo/authorize");
    }

    private static Map<String, String> verifyBody(String orderId, String gatewayOrderId, String paymentId, String signature) {
        return Map.of(
                "orderId", orderId,
                "gatewayOrderId", gatewayOrderId,
                "gatewayPaymentId", paymentId,
                "signature", signature);
    }
}
