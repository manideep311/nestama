package com.nestama.apitests.support;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Unique, valid request bodies so tests never depend on each other's data. */
public final class TestData {

    public static final String PASSWORD = "Wag-tail-2026!";
    /** Same domain the server's own integration tests use for throwaway accounts. */
    public static final String EMAIL_DOMAIN = "test.nestama.dev";

    private TestData() {}

    public static String uniqueEmail(String tag) {
        return "api-" + tag + "-" + UUID.randomUUID().toString().substring(0, 8) + "@" + EMAIL_DOMAIN;
    }

    public static Map<String, Object> signUpBody(String name, String email, String password) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("email", email);
        body.put("password", password);
        return body;
    }

    /** A delivery address that passes every server-side rule (Indian mobile, state and pincode). */
    public static Map<String, Object> address(String fullName) {
        Map<String, Object> body = new HashMap<>();
        body.put("fullName", fullName);
        body.put("phone", "9876543210");
        body.put("line1", "12 MG Road");
        body.put("city", "Hyderabad");
        body.put("state", "Telangana");
        body.put("pincode", "500032");
        body.put("isDefault", true);
        return body;
    }
}
