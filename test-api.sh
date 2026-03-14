#!/bin/bash
# DeepJelly HTTP API Test Script
# Tests the API endpoints exposed for AI tools

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:12261}"
API_BASE="${API_BASE_URL}/api/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_section() {
    echo ""
    echo -e "${YELLOW}=== $1 ===${NC}"
}

print_test() {
    echo ""
    echo -e "${YELLOW}TEST: $1${NC}"
    echo "Request: $2"
}

print_success() {
    echo -e "${GREEN}✓ PASSED${NC}: $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_fail() {
    echo -e "${RED}✗ FAILED${NC}: $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

# Run a test
run_test() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_code="$5"
    local token="$6"

    TESTS_RUN=$((TESTS_RUN + 1))
    print_test "$test_name" "$method $endpoint"

    local url="${API_BASE}${endpoint}"
    local auth_header=""
    if [ -n "$token" ]; then
        auth_header="-H \"Authorization: Bearer $token\""
    fi

    local response
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$url" $auth_header -H "Content-Type: application/json")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" $auth_header -H "Content-Type: application/json" -d "$data")
    elif [ "$method" = "PATCH" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PATCH "$url" $auth_header -H "Content-Type: application/json" -d "$data")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$url" $auth_header -H "Content-Type: application/json")
    fi

    local body=$(echo "$response" | sed '$d')
    local status_code=$(echo "$response" | tail -n 1)

    if [ "$status_code" = "$expected_code" ]; then
        print_success "$test_name (HTTP $status_code)"
        echo "Response: $body"
    else
        print_fail "$test_name (expected HTTP $expected_code, got $status_code)"
        echo "Response: $body"
    fi
}

# ============================================================================
# Main Test Suite
# ============================================================================

print_section "DeepJelly HTTP API Test Suite"
echo "API Base URL: $API_BASE_URL"

# ============================================================================
# Health Check
# ============================================================================
print_section "Health Check"

run_test "Health check" "GET" "/health" "" "200" ""

# ============================================================================
# Integration Domain - App Integrations (Read-only)
# ============================================================================
print_section "Integration Domain - App Integrations (Read-only)"

run_test "List app integrations" "GET" "/integration/app" "" "200" ""

# Note: POST/PATCH/DELETE for app integrations are removed (managed manually by users)

run_test "Test connection" "POST" "/integration/app/test" \
    '{"endpoint": "ws://192.168.1.100:18790"}' "200" ""

# ============================================================================
# Integration Domain - Character Integrations
# ============================================================================
print_section "Integration Domain - Character Integrations"

run_test "List character integrations" "GET" "/integration/character" "" "200" ""

# Note: These tests will fail without authentication and valid data
# They are here to document the API structure

# POST /api/v1/integration/character (requires auth)
run_test "Add character integration (no auth - expect 401)" "POST" "/integration/character" \
    '{"character_id": "test_char", "integration_id": "test_integration"}' "401" ""

# ============================================================================
# Content Domain - Assistants
# ============================================================================
print_section "Content Domain - Assistants"

run_test "List assistants" "GET" "/content/assistant" "" "200" ""

run_test "Create assistant (no auth - expect 401)" "POST" "/content/assistant" \
    '{"name": "Test Assistant"}' "401" ""

# ============================================================================
# Content Domain - Characters
# ============================================================================
print_section "Content Domain - Characters"

run_test "List characters" "GET" "/content/character" "" "200" ""

# ============================================================================
# Content Domain - Appearances
# ============================================================================
print_section "Content Domain - Appearances"

run_test "List appearances" "GET" "/content/appearance" "" "200" ""

# ============================================================================
# Content Domain - Config
# ============================================================================
print_section "Content Domain - Config"

run_test "Get config paths" "GET" "/content/config/paths" "" "200" ""

# ============================================================================
# Authentication Tests
# ============================================================================
print_section "Authentication Tests"

# Test with invalid token (should fail)
run_test "Protected endpoint with invalid token" "GET" "/integration/character" "" "401" "invalid_token_xxx"

# ============================================================================
# Summary
# ============================================================================
print_section "Test Summary"

echo "Tests run: $TESTS_RUN"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
