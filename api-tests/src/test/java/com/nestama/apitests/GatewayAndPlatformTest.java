package com.nestama.apitests;

import static io.restassured.RestAssured.given;
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.nestama.apitests.support.Api;
import com.nestama.apitests.support.ApiConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Platform: health check, proxy gate and error handling")
class GatewayAndPlatformTest {

    @Test
    @DisplayName("health check answers without the proxy secret and reports the database as up")
    void healthIsOpenAndReportsDatabase() {
        given().spec(Api.specWithoutProxySecret())
                .when().get(Api.V1 + "/health")
                .then()
                .statusCode(200)
                .body("ok", equalTo(true))
                .body("db", equalTo("up"));
    }

    @Test
    @DisplayName("calls that skip the storefront proxy are refused with DIRECT_ACCESS")
    void requestWithoutProxySecretIsRefused() {
        assumeTrue(ApiConfig.proxySecret().isPresent(), "API started without PROXY_SECRET, so the gate is open");
        given().spec(Api.specWithoutProxySecret())
                .when().get(Api.V1 + "/products")
                .then()
                .statusCode(403)
                .body(matchesJsonSchemaInClasspath("schemas/error.json"))
                .body("error.code", equalTo("DIRECT_ACCESS"));
    }

    @Test
    @DisplayName("a wrong proxy secret is refused the same way as a missing one")
    void wrongProxySecretIsRefused() {
        assumeTrue(ApiConfig.proxySecret().isPresent(), "API started without PROXY_SECRET, so the gate is open");
        given().spec(Api.specWithoutProxySecret())
                .header(ApiConfig.PROXY_HEADER, "not-the-real-secret-but-the-same-length-xx")
                .when().get(Api.V1 + "/products")
                .then()
                .statusCode(403)
                .body("error.code", equalTo("DIRECT_ACCESS"));
    }

    @Test
    @DisplayName("unknown routes return 404 in the standard error envelope")
    void unknownRouteReturnsErrorEnvelope() {
        given().spec(Api.spec())
                .when().get(Api.V1 + "/this-route-does-not-exist")
                .then()
                .statusCode(404)
                .body(matchesJsonSchemaInClasspath("schemas/error.json"))
                .body("error.code", equalTo("NOT_FOUND"));
    }

    @Test
    @DisplayName("malformed JSON bodies are rejected with BAD_JSON instead of a 500")
    void malformedJsonIsRejected() {
        given().spec(Api.spec())
                .body("{\"variantId\": ")
                .when().post(Api.V1 + "/cart/items")
                .then()
                .statusCode(400)
                .body("error.code", equalTo("BAD_JSON"));
    }

    @Test
    @DisplayName("security headers are set and the framework is not advertised")
    void securityHeadersArePresent() {
        given().spec(Api.spec())
                .when().get(Api.V1 + "/health")
                .then()
                .statusCode(200)
                .header("X-Content-Type-Options", equalTo("nosniff"))
                .header("X-Frame-Options", equalTo("SAMEORIGIN"))
                .header("X-Powered-By", nullValue());
    }
}
