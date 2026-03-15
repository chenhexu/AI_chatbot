#!/bin/bash
# Test runner script for UI tests

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print usage
print_usage() {
    echo -e "\n${YELLOW}Available test commands:${NC}\n"
    echo "  npm test                    - Run all tests"
    echo "  npm run test:watch          - Run tests in watch mode"
    echo "  npm run test:coverage       - Generate coverage report"
    echo ""
    echo -e "${YELLOW}Test patterns:${NC}\n"
    echo "  npm test -- --testNamePattern=\"table\"     - Run table tests only"
    echo "  npm test -- --testNamePattern=\"list\"      - Run list tests only"
    echo "  npm test -- --testNamePattern=\"formatting\" - Run formatting tests"
    echo "  npm test -- --testNamePattern=\"header\"    - Run header tests"
    echo "  npm test -- --testNamePattern=\"code\"      - Run code block tests"
    echo "  npm test -- --testNamePattern=\"link\"      - Run link tests"
    echo "  npm test -- --testNamePattern=\"color\"     - Run color tests"
    echo ""
    echo -e "${YELLOW}Component-specific tests:${NC}\n"
    echo "  npm test -- MessageBubble   - Run MessageBubble tests"
    echo "  npm test -- ChatContainer   - Run ChatContainer tests"
    echo "  npm test -- integration     - Run integration tests"
    echo ""
}

# Function to run tests
run_tests() {
    local pattern=$1
    local extra_args=$2

    echo -e "${GREEN}Running tests with pattern: ${pattern}${NC}\n"

    if [ -z "$extra_args" ]; then
        npm test -- --testNamePattern="$pattern"
    else
        npm test -- --testNamePattern="$pattern" "$extra_args"
    fi
}

# Main script
case "$1" in
    help|--help|-h)
        print_usage
        ;;
    table)
        run_tests "table" "$2"
        ;;
    list)
        run_tests "list" "$2"
        ;;
    formatting)
        run_tests "formatting" "$2"
        ;;
    header)
        run_tests "header" "$2"
        ;;
    code)
        run_tests "code" "$2"
        ;;
    link)
        run_tests "link" "$2"
        ;;
    color)
        run_tests "color" "$2"
        ;;
    all)
        npm test
        ;;
    *)
        if [ -z "$1" ]; then
            print_usage
        else
            echo -e "${RED}Unknown command: $1${NC}"
            print_usage
            exit 1
        fi
        ;;
esac
