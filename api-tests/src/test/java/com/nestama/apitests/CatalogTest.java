package com.nestama.apitests;

import static io.restassured.RestAssured.given;
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.in;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.nestama.apitests.support.Api;
import com.nestama.apitests.support.Catalog;
import io.restassured.response.Response;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@DisplayName("Catalog: listing, filters, product pages, search and delivery estimates")
class CatalogTest {

    @Test
    @DisplayName("product list matches its contract and paginates correctly")
    void productListPaginates() {
        Response response = given().spec(Api.spec())
                .queryParam("pageSize", 5)
                .when().get(Api.V1 + "/products")
                .then()
                .statusCode(200)
                .body(matchesJsonSchemaInClasspath("schemas/product-list.json"))
                .body("items", hasSize(5))
                .body("page", equalTo(1))
                .body("pageSize", equalTo(5))
                .extract().response();

        int total = response.path("total");
        int totalPages = response.path("totalPages");
        assertTrue(total > 5, "seeded catalogue should have more than one page of products");
        assertEquals((int) Math.ceil(total / 5.0), totalPages, "totalPages = ceil(total / pageSize)");
    }

    @Test
    @DisplayName("page 2 returns different products from page 1")
    void pagesDoNotOverlap() {
        List<String> first = given().spec(Api.spec()).queryParam("pageSize", 5).queryParam("page", 1)
                .get(Api.V1 + "/products").then().statusCode(200).extract().path("items.id");
        List<String> second = given().spec(Api.spec()).queryParam("pageSize", 5).queryParam("page", 2)
                .get(Api.V1 + "/products").then().statusCode(200).extract().path("items.id");
        assertTrue(second.stream().noneMatch(first::contains), "pages must not repeat products");
    }

    @ParameterizedTest(name = "pageSize={0} is rejected")
    @ValueSource(ints = {0, 49, 500})
    @DisplayName("page sizes outside 1–48 are rejected with a field error")
    void pageSizeOutsideLimitsIsRejected(int pageSize) {
        given().spec(Api.spec())
                .queryParam("pageSize", pageSize)
                .when().get(Api.V1 + "/products")
                .then()
                .statusCode(400)
                .body(matchesJsonSchemaInClasspath("schemas/error.json"))
                .body("error.code", equalTo("VALIDATION_ERROR"))
                .body("error.details.fieldErrors", hasKey("pageSize"));
    }

    @Test
    @DisplayName("filtering by cat returns only cat or both-pet products")
    void petFilterReturnsOnlyThatPet() {
        given().spec(Api.spec())
                .queryParam("pet", "cat")
                .queryParam("pageSize", 48)
                .when().get(Api.V1 + "/products")
                .then()
                .statusCode(200)
                .body("items", not(hasSize(0)))
                .body("items.petType", everyItem(in(List.of("CAT", "BOTH"))));
    }

    @Test
    @DisplayName("sorting by price-asc orders products by their selling price")
    void priceAscendingSortIsOrdered() {
        List<Integer> prices = given().spec(Api.spec())
                .queryParam("sort", "price-asc")
                .queryParam("pageSize", 24)
                .when().get(Api.V1 + "/products")
                .then().statusCode(200)
                .extract().path("items.pricing.salePrice");
        for (int i = 1; i < prices.size(); i++) {
            assertTrue(prices.get(i - 1) <= prices.get(i), "price at " + i + " is lower than the one before it: " + prices);
        }
    }

    @Test
    @DisplayName("an unknown sort value is rejected")
    void unknownSortIsRejected() {
        given().spec(Api.spec())
                .queryParam("sort", "cheapest-first")
                .when().get(Api.V1 + "/products")
                .then()
                .statusCode(400)
                .body("error.details.fieldErrors", hasKey("sort"));
    }

    @Test
    @DisplayName("a product page matches its contract and no variant sells above its list price")
    void productDetailBySlug() {
        String slug = Catalog.firstProductSlug();
        Response response = given().spec(Api.spec())
                .when().get(Api.V1 + "/products/" + slug)
                .then()
                .statusCode(200)
                .body(matchesJsonSchemaInClasspath("schemas/product-detail.json"))
                .body("slug", equalTo(slug))
                .body("variants.sku", everyItem(notNullValue()))
                .extract().response();

        List<Integer> listPrices = response.path("variants.pricing.price");
        List<Integer> salePrices = response.path("variants.pricing.salePrice");
        for (int i = 0; i < listPrices.size(); i++) {
            assertThat("variant " + i + " sale price", salePrices.get(i), lessThanOrEqualTo(listPrices.get(i)));
        }
    }

    @Test
    @DisplayName("an unknown product slug returns 404")
    void unknownProductReturns404() {
        given().spec(Api.spec())
                .when().get(Api.V1 + "/products/no-such-product-anywhere")
                .then()
                .statusCode(404)
                .body("error.code", equalTo("NOT_FOUND"));
    }

    @Test
    @DisplayName("a slug with invalid characters is rejected before any lookup")
    void invalidSlugIsRejected() {
        given().spec(Api.spec())
                .when().get(Api.V1 + "/products/Not_A_Valid_Slug")
                .then()
                .statusCode(400)
                .body("error.code", equalTo("VALIDATION_ERROR"))
                .body("error.details.fieldErrors", hasKey("slug"));
    }

    @Test
    @DisplayName("categories are listed with their product counts")
    void categoriesAreListed() {
        given().spec(Api.spec())
                .when().get(Api.V1 + "/categories")
                .then()
                .statusCode(200)
                .body("size()", greaterThan(0))
                .body("slug", everyItem(notNullValue()))
                .body("productCount", everyItem(notNullValue()));
    }

    @Test
    @DisplayName("search finds products and echoes the query")
    void searchFindsProducts() {
        given().spec(Api.spec())
                .queryParam("q", "bed")
                .when().get(Api.V1 + "/search")
                .then()
                .statusCode(200)
                .body("query", equalTo("bed"))
                .body("products", not(hasSize(0)));
    }

    @Test
    @DisplayName("an empty search query is rejected")
    void emptySearchIsRejected() {
        given().spec(Api.spec())
                .queryParam("q", "   ")
                .when().get(Api.V1 + "/search")
                .then()
                .statusCode(400)
                .body("error.details.fieldErrors", hasKey("q"));
    }

    @Test
    @DisplayName("delivery estimate for a valid pincode gives a sensible date range")
    void deliveryEstimateForValidPincode() {
        Response response = given().spec(Api.spec())
                .queryParam("pincode", "500032")
                .when().get(Api.V1 + "/delivery-estimate")
                .then()
                .statusCode(200)
                .body("pincode", equalTo("500032"))
                .extract().response();
        int min = response.path("minDays");
        int max = response.path("maxDays");
        assertTrue(min > 0 && min <= max, "expected 0 < minDays <= maxDays, got " + min + ".." + max);
    }

    @ParameterizedTest(name = "pincode \"{0}\" is rejected")
    @ValueSource(strings = {"012345", "50003", "5000321", "ABCDEF"})
    @DisplayName("invalid pincodes are rejected")
    void deliveryEstimateRejectsInvalidPincodes(String pincode) {
        given().spec(Api.spec())
                .queryParam("pincode", pincode)
                .when().get(Api.V1 + "/delivery-estimate")
                .then()
                .statusCode(400)
                .body("error.details.fieldErrors.pincode", hasItem("Enter a valid 6-digit pincode"));
    }
}
