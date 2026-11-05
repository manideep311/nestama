package com.nestama.apitests.support;

import static io.restassured.RestAssured.given;

import io.restassured.filter.cookie.CookieFilter;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;
import java.util.Map;

/**
 * One API client with its own cookie jar, like one browser. A guest session keeps the guest-cart
 * cookie; a customer session also keeps the Better Auth session cookie from sign-up.
 */
public final class Session {

    private final CookieFilter cookies = new CookieFilter();
    private String email;
    private String userId;

    private Session() {}

    public static Session guest() {
        return new Session();
    }

    /** Registers a brand-new customer through the real sign-up endpoint and stays signed in. */
    public static Session newCustomer(String tag) {
        Session session = new Session();
        String email = TestData.uniqueEmail(tag);
        Response response = session.request()
                .body(TestData.signUpBody("Api Test " + tag, email, TestData.PASSWORD))
                .post(Api.AUTH + "/sign-up/email");
        if (response.statusCode() != 200) {
            throw new IllegalStateException("Sign-up failed (" + response.statusCode() + "): " + response.asString());
        }
        session.email = email;
        session.userId = response.path("user.id");
        return session;
    }

    /** A request that sends and stores this session's cookies. */
    public RequestSpecification request() {
        return given().spec(Api.spec()).filter(cookies);
    }

    public String email() {
        return email;
    }

    public String userId() {
        return userId;
    }

    /** Adds a variant to this session's cart. */
    public Response addToCart(String variantId, int quantity) {
        return request().body(Map.of("variantId", variantId, "quantity", quantity)).post(Api.V1 + "/cart/items");
    }

    /** Saves a valid delivery address and returns its id. */
    public String createAddress() {
        return request()
                .body(TestData.address("Api Test Customer"))
                .post(Api.V1 + "/account/addresses")
                .then()
                .statusCode(201)
                .extract()
                .path("id");
    }
}
