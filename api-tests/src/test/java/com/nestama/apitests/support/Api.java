package com.nestama.apitests.support;

import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;

/** Shared request setup and the API's route prefixes. */
public final class Api {

    /** Express routes live under /api/v1; Better Auth lives under /api/auth. */
    public static final String V1 = "/api/v1";
    public static final String AUTH = "/api/auth";

    static {
        // Print the full request and response, but only for a request whose assertions failed.
        RestAssured.enableLoggingOfRequestAndResponseIfValidationFails();
    }

    private Api() {}

    /** JSON request to the API, carrying the proxy secret when one is configured. */
    public static RequestSpecification spec() {
        RequestSpecBuilder builder = new RequestSpecBuilder()
                .setBaseUri(ApiConfig.baseUrl())
                .setContentType(ContentType.JSON)
                .setAccept(ContentType.JSON);
        ApiConfig.proxySecret().ifPresent(secret -> builder.addHeader(ApiConfig.PROXY_HEADER, secret));
        return builder.build();
    }

    /** Same as {@link #spec()} but without the proxy secret, to test the gate itself. */
    public static RequestSpecification specWithoutProxySecret() {
        return new RequestSpecBuilder()
                .setBaseUri(ApiConfig.baseUrl())
                .setContentType(ContentType.JSON)
                .setAccept(ContentType.JSON)
                .build();
    }
}
