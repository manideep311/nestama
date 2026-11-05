package com.nestama.apitests;

import static io.restassured.RestAssured.given;
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.hamcrest.Matchers.equalTo;

import com.nestama.apitests.support.Api;
import com.nestama.apitests.support.Catalog;
import com.nestama.apitests.support.Session;
import io.restassured.response.Response;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@DisplayName("Access control: sign-in required, admin only, and one customer can't touch another's data")
class AccessControlTest {

    @ParameterizedTest(name = "GET {0} needs a signed-in user")
    @ValueSource(strings = {"/wishlist", "/account/addresses", "/account/orders", "/account/pets"})
    @DisplayName("account endpoints return 401 to anonymous callers")
    void accountEndpointsNeedSignIn(String path) {
        given().spec(Api.spec())
                .when().get(Api.V1 + path)
                .then()
                .statusCode(401)
                .body(matchesJsonSchemaInClasspath("schemas/error.json"))
                .body("error.code", equalTo("UNAUTHENTICATED"));
    }

    @Test
    @DisplayName("checkout returns 401 to anonymous callers")
    void checkoutNeedsSignIn() {
        given().spec(Api.spec())
                .body(Map.of("addressId", "anything"))
                .when().post(Api.V1 + "/checkout/orders")
                .then()
                .statusCode(401)
                .body("error.code", equalTo("UNAUTHENTICATED"));
    }

    @ParameterizedTest(name = "GET /admin{0} is admin-only")
    @ValueSource(strings = {"/products", "/categories", "/settings"})
    @DisplayName("admin endpoints return 403 to a signed-in customer")
    void adminEndpointsForbidCustomers(String path) {
        Session.newCustomer("notadmin").request()
                .when().get(Api.V1 + "/admin" + path)
                .then()
                .statusCode(403)
                .body("error.code", equalTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("admin endpoints return 401 (not 403) to anonymous callers")
    void adminEndpointsNeedSignIn() {
        given().spec(Api.spec())
                .when().get(Api.V1 + "/admin/products")
                .then()
                .statusCode(401)
                .body("error.code", equalTo("UNAUTHENTICATED"));
    }

    @Test
    @DisplayName("a customer cannot read another customer's order (no IDOR)")
    void cannotReadAnotherCustomersOrder() {
        Session owner = Session.newCustomer("owner");
        String addressId = owner.createAddress();
        owner.addToCart(Catalog.inStockVariantId(), 1).then().statusCode(201);
        Response order = owner.request()
                .body(Map.of("addressId", addressId))
                .post(Api.V1 + "/checkout/orders")
                .then().statusCode(201).extract().response();

        Session.newCustomer("snoop").request()
                .when().get(Api.V1 + "/orders/" + order.path("orderId"))
                .then()
                .statusCode(404)
                .body("error.code", equalTo("ORDER_NOT_FOUND"));
    }

    @Test
    @DisplayName("a customer cannot check out to another customer's saved address")
    void cannotUseAnotherCustomersAddress() {
        String victimAddressId = Session.newCustomer("victim").createAddress();
        Session attacker = Session.newCustomer("attacker");
        attacker.addToCart(Catalog.inStockVariantId(), 1).then().statusCode(201);

        attacker.request()
                .body(Map.of("addressId", victimAddressId))
                .when().post(Api.V1 + "/checkout/orders")
                .then()
                .statusCode(404)
                .body("error.code", equalTo("ADDRESS_NOT_FOUND"));
    }

    @Test
    @DisplayName("a customer cannot delete another customer's address")
    void cannotDeleteAnotherCustomersAddress() {
        Session victim = Session.newCustomer("victim2");
        String addressId = victim.createAddress();

        Session.newCustomer("attacker2").request()
                .when().delete(Api.V1 + "/account/addresses/" + addressId)
                .then()
                .statusCode(404);

        victim.request()
                .when().get(Api.V1 + "/account/addresses")
                .then()
                .statusCode(200)
                .body("id", org.hamcrest.Matchers.hasItem(addressId));
    }

    @Test
    @DisplayName("writes sent from another website's origin are blocked")
    void crossSiteWriteIsBlocked() {
        given().spec(Api.spec())
                .header("Origin", "https://evil.example")
                .body(Map.of("email", "someone@example.com"))
                .when().post(Api.V1 + "/newsletter")
                .then()
                .statusCode(403)
                .body("error.code", equalTo("FORBIDDEN_ORIGIN"));
    }
}
