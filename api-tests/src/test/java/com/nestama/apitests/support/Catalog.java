package com.nestama.apitests.support;

import static io.restassured.RestAssured.given;

/** Looks up real catalogue data at run time, so tests don't hard-code seeded ids. */
public final class Catalog {

    private Catalog() {}

    /** The default variant of the first in-stock product, priced so that cart maths is easy to check. */
    public static String inStockVariantId() {
        return given().spec(Api.spec())
                .queryParam("inStock", "true")
                .queryParam("pageSize", 1)
                .get(Api.V1 + "/products")
                .then()
                .statusCode(200)
                .extract()
                .path("items[0].defaultVariantId");
    }

    public static String firstProductSlug() {
        return given().spec(Api.spec())
                .queryParam("pageSize", 1)
                .get(Api.V1 + "/products")
                .then()
                .statusCode(200)
                .extract()
                .path("items[0].slug");
    }

    public static String firstProductId() {
        return given().spec(Api.spec())
                .queryParam("pageSize", 1)
                .get(Api.V1 + "/products")
                .then()
                .statusCode(200)
                .extract()
                .path("items[0].id");
    }
}
