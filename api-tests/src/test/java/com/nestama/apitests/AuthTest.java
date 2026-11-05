package com.nestama.apitests;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

import com.nestama.apitests.support.Api;
import com.nestama.apitests.support.ApiConfig;
import com.nestama.apitests.support.Session;
import com.nestama.apitests.support.TestData;
import io.restassured.filter.cookie.CookieFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Auth: sign-up, sign-in, sessions and origin checks")
class AuthTest {

    @Test
    @DisplayName("sign-up creates a CUSTOMER and never returns the password")
    void signUpCreatesCustomer() {
        String email = TestData.uniqueEmail("signup");
        given().spec(Api.spec())
                .body(TestData.signUpBody("New Pawrent", email, TestData.PASSWORD))
                .when().post(Api.AUTH + "/sign-up/email")
                .then()
                .statusCode(200)
                .body("user.email", equalTo(email))
                .body("user.role", equalTo("CUSTOMER"))
                .body("user.id", notNullValue())
                .body(not(containsString(TestData.PASSWORD)))
                .body("user.password", nullValue());
    }

    @Test
    @DisplayName("signing up twice with the same email is refused")
    void duplicateEmailIsRefused() {
        Session existing = Session.newCustomer("dup");
        given().spec(Api.spec())
                .body(TestData.signUpBody("Someone Else", existing.email(), TestData.PASSWORD))
                .when().post(Api.AUTH + "/sign-up/email")
                .then()
                .statusCode(422)
                .body("code", equalTo("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"));
    }

    @Test
    @DisplayName("passwords shorter than 8 characters are rejected")
    void shortPasswordIsRejected() {
        given().spec(Api.spec())
                .body(TestData.signUpBody("Short Pass", TestData.uniqueEmail("short"), "abc123"))
                .when().post(Api.AUTH + "/sign-up/email")
                .then()
                .statusCode(400)
                .body("code", equalTo("PASSWORD_TOO_SHORT"));
    }

    @Test
    @DisplayName("a one-letter name is rejected by the profile rules")
    void tooShortNameIsRejected() {
        given().spec(Api.spec())
                .body(TestData.signUpBody("A", TestData.uniqueEmail("name"), TestData.PASSWORD))
                .when().post(Api.AUTH + "/sign-up/email")
                .then()
                .statusCode(400)
                .body("message", containsString("Enter your name"));
    }

    @Test
    @DisplayName("a wrong password gets 401 and the same message as an unknown email")
    void wrongPasswordIsUnauthorized() {
        Session customer = Session.newCustomer("wrongpw");
        String wrongPasswordMessage = given().spec(Api.spec())
                .body(java.util.Map.of("email", customer.email(), "password", "not-my-password"))
                .when().post(Api.AUTH + "/sign-in/email")
                .then()
                .statusCode(401)
                .body("code", equalTo("INVALID_EMAIL_OR_PASSWORD"))
                .extract().path("message");

        // No account enumeration: an unknown email must look exactly the same.
        given().spec(Api.spec())
                .body(java.util.Map.of("email", TestData.uniqueEmail("ghost"), "password", "not-my-password"))
                .when().post(Api.AUTH + "/sign-in/email")
                .then()
                .statusCode(401)
                .body("message", equalTo(wrongPasswordMessage));
    }

    @Test
    @DisplayName("signing in starts a session that get-session can read, and sign-out ends it")
    void signInSessionAndSignOut() {
        Session customer = Session.newCustomer("signin");
        CookieFilter browser = new CookieFilter();

        given().spec(Api.spec()).filter(browser)
                .body(java.util.Map.of("email", customer.email(), "password", TestData.PASSWORD))
                .when().post(Api.AUTH + "/sign-in/email")
                .then()
                .statusCode(200);

        given().spec(Api.spec()).filter(browser)
                .when().get(Api.AUTH + "/get-session")
                .then()
                .statusCode(200)
                .body("user.email", equalTo(customer.email()));

        given().spec(Api.spec()).filter(browser)
                .header("Origin", ApiConfig.clientOrigin())
                .body("{}")
                .when().post(Api.AUTH + "/sign-out")
                .then()
                .statusCode(200);

        given().spec(Api.spec()).filter(browser)
                .when().get(Api.V1 + "/wishlist")
                .then()
                .statusCode(401)
                .body("error.code", equalTo("UNAUTHENTICATED"));
    }

    @Test
    @DisplayName("sign-up from another website's origin is blocked")
    void crossSiteSignUpIsBlocked() {
        given().spec(Api.spec())
                .header("Origin", "https://evil.example")
                .body(TestData.signUpBody("Evil Site", TestData.uniqueEmail("evil"), TestData.PASSWORD))
                .when().post(Api.AUTH + "/sign-up/email")
                .then()
                .statusCode(403)
                .body("code", equalTo("INVALID_ORIGIN"));
    }
}
