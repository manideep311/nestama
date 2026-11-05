package com.nestama.apitests.support;

import java.util.Optional;

/**
 * Where the API under test lives. Values come from a JVM system property first, then an
 * environment variable, so the same suite runs locally and in CI without code changes.
 *
 * <ul>
 *   <li>{@code api.url} / {@code NESTAMA_API_URL}: base URL of the Express API (default {@code http://localhost:4000})</li>
 *   <li>{@code proxy.secret} / {@code NESTAMA_PROXY_SECRET}: the storefront's shared proxy secret, when the API
 *       is started with {@code PROXY_SECRET} set (optional)</li>
 *   <li>{@code client.origin} / {@code NESTAMA_CLIENT_ORIGIN}: the storefront origin the API trusts (default
 *       {@code http://localhost:3000})</li>
 * </ul>
 */
public final class ApiConfig {

    public static final String PROXY_HEADER = "x-nestama-proxy";

    private ApiConfig() {}

    public static String baseUrl() {
        return read("api.url", "NESTAMA_API_URL").orElse("http://localhost:4000");
    }

    public static Optional<String> proxySecret() {
        return read("proxy.secret", "NESTAMA_PROXY_SECRET");
    }

    public static String clientOrigin() {
        return read("client.origin", "NESTAMA_CLIENT_ORIGIN").orElse("http://localhost:3000");
    }

    private static Optional<String> read(String property, String envVar) {
        String value = System.getProperty(property);
        if (value == null || value.isBlank()) value = System.getenv(envVar);
        return value == null || value.isBlank() ? Optional.empty() : Optional.of(value.trim());
    }
}
