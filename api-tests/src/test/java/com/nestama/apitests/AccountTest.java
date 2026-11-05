package com.nestama.apitests;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.not;

import com.nestama.apitests.support.Api;
import com.nestama.apitests.support.Catalog;
import com.nestama.apitests.support.Session;
import com.nestama.apitests.support.TestData;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Account: delivery addresses and wishlist")
class AccountTest {

    @Test
    @DisplayName("an address can be created, listed, updated and deleted")
    void addressLifecycle() {
        Session customer = Session.newCustomer("address");

        Map<String, Object> body = TestData.address("Priya Sharma");
        body.put("phone", "+91 98765 43210");
        String id = customer.request()
                .body(body)
                .when().post(Api.V1 + "/account/addresses")
                .then()
                .statusCode(201)
                .body("fullName", equalTo("Priya Sharma"))
                .body("phone", equalTo("9876543210")) // +91 and spaces are normalised away
                .body("isDefault", equalTo(true))
                .extract().path("id");

        customer.request()
                .when().get(Api.V1 + "/account/addresses")
                .then()
                .statusCode(200)
                .body("id", hasItem(id));

        body.put("city", "Secunderabad");
        customer.request()
                .body(body)
                .when().patch(Api.V1 + "/account/addresses/" + id)
                .then()
                .statusCode(200)
                .body("city", equalTo("Secunderabad"));

        customer.request()
                .when().delete(Api.V1 + "/account/addresses/" + id)
                .then()
                .statusCode(200);

        customer.request()
                .when().get(Api.V1 + "/account/addresses")
                .then()
                .statusCode(200)
                .body("id", not(hasItem(id)));
    }

    @Test
    @DisplayName("an invalid address reports every bad field at once")
    void invalidAddressReportsEachField() {
        Map<String, Object> body = TestData.address("Priya Sharma");
        body.put("phone", "12345");
        body.put("state", "Atlantis");
        body.put("pincode", "011001");

        Session.newCustomer("badaddress").request()
                .body(body)
                .when().post(Api.V1 + "/account/addresses")
                .then()
                .statusCode(400)
                .body("error.code", equalTo("VALIDATION_ERROR"))
                .body("error.details.fieldErrors", hasKey("phone"))
                .body("error.details.fieldErrors", hasKey("state"))
                .body("error.details.fieldErrors", hasKey("pincode"));
    }

    @Test
    @DisplayName("a product can be added to and removed from the wishlist")
    void wishlistAddAndRemove() {
        Session customer = Session.newCustomer("wishlist");
        String productId = Catalog.firstProductId();

        customer.request()
                .body(Map.of("productId", productId))
                .when().post(Api.V1 + "/wishlist")
                .then()
                .statusCode(201)
                .body("productIds", hasItem(productId));

        customer.request()
                .when().get(Api.V1 + "/wishlist")
                .then()
                .statusCode(200)
                .body("productIds", hasItem(productId));

        customer.request()
                .when().delete(Api.V1 + "/wishlist/" + productId)
                .then()
                .statusCode(200)
                .body("productIds", not(hasItem(productId)));
    }
}
