#!/bin/bash

# Morning Verification Script for Night Sprint
# Run this when you wake up to verify all parallel agent work completed successfully

set -e

echo "========================================="
echo "🌅 Agent Config Manager - Morning Verification"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS++))
}

check_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAIL++))
}

check_warn() {
    echo -e "${YELLOW}⚠ INFO${NC}: $1"
}

echo "📋 Step 1: Checking Git History"
echo "================================"
if git log --oneline | head -1 | grep -q "docs: Add parallel"; then
    check_pass "Recent commits found"
else
    check_fail "No recent commits - agents may not have completed"
fi

echo ""
echo "📦 Step 2: Checking Build"
echo "========================="
echo "Running: pnpm build..."
if pnpm build > /dev/null 2>&1; then
    check_pass "Build successful"
else
    check_fail "Build failed - see details above"
fi

echo ""
echo "🧪 Step 3: Checking Tests"
echo "========================="
echo "Running: pnpm test..."
TEST_OUTPUT=$(pnpm test 2>&1 || true)
TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -oP 'Tests\s+\d+\s+passed' | grep -oP '\d+' || echo "0")

if [ "$TEST_COUNT" -gt 600 ]; then
    check_pass "Tests passing ($TEST_COUNT tests)"
elif [ "$TEST_COUNT" -gt 500 ]; then
    check_warn "Tests passing but lower than expected ($TEST_COUNT tests)"
else
    check_fail "Insufficient tests passing ($TEST_COUNT tests, expected 600+)"
fi

echo ""
echo "📊 Step 4: Checking Provider Catalog"
echo "===================================="
PROVIDER_COUNT=$(grep -c '"id":' packages/gui/src/data/known-providers.ts || echo "0")
if [ "$PROVIDER_COUNT" -ge 30 ]; then
    check_pass "Provider catalog has $PROVIDER_COUNT providers"
else
    check_fail "Provider catalog incomplete ($PROVIDER_COUNT providers, expected 30+)"
fi

echo ""
echo "🤖 Step 5: Checking Agent Catalog"
echo "=================================="
AGENT_COUNT=$(grep -c '"id":' packages/core/src/agent-catalog-extended.ts || echo "0")
if [ "$AGENT_COUNT" -ge 10 ]; then
    check_pass "Agent catalog has $AGENT_COUNT agents"
else
    check_fail "Agent catalog incomplete ($AGENT_COUNT agents, expected 20+)"
fi

echo ""
echo "🛠️  Step 6: Checking CLI Tools Catalog"
echo "====================================="
CLI_COUNT=$(grep -c '"id":' packages/core/src/cli-tools-catalog.ts || echo "0")
if [ "$CLI_COUNT" -ge 40 ]; then
    check_pass "CLI tools catalog has $CLI_COUNT tools"
else
    check_fail "CLI tools catalog incomplete ($CLI_COUNT tools, expected 50+)"
fi

echo ""
echo "📖 Step 7: Checking README"
echo "=========================="
if grep -q "Configure Once" README.md; then
    check_pass "README has new PM-friendly content"
else
    check_fail "README may not have been updated"
fi

if ! grep -q "—" README.md; then
    check_pass "README has no em dashes"
else
    check_warn "README may still contain em dashes - verify manually"
fi

echo ""
echo "🎨 Step 8: Checking UI Styling"
echo "=============================="
if grep -q "dark:" packages/gui/src/index.css; then
    check_pass "Dark mode styling detected"
else
    check_warn "Dark mode styling not detected - may need verification"
fi

echo ""
echo "========================================="
echo "✅ Verification Summary"
echo "========================================="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED!${NC}"
    echo "Your night sprint is complete and ready for review."
    echo ""
    echo "Next steps:"
    echo "1. Review git log: git log --oneline | head -15"
    echo "2. Check commits: git diff HEAD~10..HEAD --stat"
    echo "3. Test UI: pnpm run start (http://localhost:4321)"
    echo "4. If satisfied: git push origin main"
    exit 0
else
    echo -e "${RED}⚠️  SOME CHECKS FAILED${NC}"
    echo "Please investigate the failures above and try again."
    echo ""
    echo "Debug tips:"
    echo "1. Run individual checks manually"
    echo "2. Check agent reports in .qwen/PARALLEL-EXECUTION-STATUS.md"
    echo "3. Review: pnpm build && pnpm test (full output)"
    exit 1
fi
