# Test-Driven Development (TDD) Guide

## Overview
Minimal TDD approach for the Form Builder Admin Panel.

## Test Setup

### Dependencies
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0"
  }
}
```

## Test Structure

### 1. Authentication (`Login.jsx`)

**Test Cases:**
- ✅ User can enter mobile and password
- ✅ Login fails with invalid credentials
- ✅ Login succeeds and stores token
- ✅ Redirects to `/home` on successful login
- ✅ Shows error message on failed login

**Example:**
```javascript
describe('Login', () => {
  it('should authenticate user with valid credentials', async () => {
    // Arrange: Mock API response
    // Act: Fill form and submit
    // Assert: Token stored, redirect occurs
  });
});
```

### 2. Form List (`Home.jsx`)

**Test Cases:**
- ✅ Loads and displays forms list
- ✅ Pagination works correctly
- ✅ Search filters forms by name
- ✅ Sort by column (created_at, name, status)
- ✅ Filter by status
- ✅ Edit button navigates to form builder
- ✅ Duplicate button creates copy
- ✅ View button opens form viewer

**Example:**
```javascript
describe('Home', () => {
  it('should filter forms by search query', async () => {
    // Arrange: Mock API with forms
    // Act: Type in search input
    // Assert: Filtered results displayed
  });
});
```

### 3. Form Builder (`NewForm.jsx`)

**Test Cases:**
- ✅ Form builder loads with empty state
- ✅ Can add form components via drag-and-drop
- ✅ Auto-save saves draft every 2 seconds
- ✅ Draft recovery on page refresh
- ✅ Save form with name, customer, status
- ✅ Edit mode loads existing form
- ✅ Duplicate mode creates new form

**Example:**
```javascript
describe('NewForm', () => {
  it('should auto-save draft every 2 seconds', async () => {
    // Arrange: Mock localStorage
    // Act: Make changes to form
    // Assert: Draft saved after 2s
  });
});
```

### 4. Form Viewer (`ViewForm.jsx`)

**Test Cases:**
- ✅ Loads form by ID from URL
- ✅ Displays form components correctly
- ✅ Form validation works
- ✅ Shows error on invalid form ID
- ✅ Handles form submission

**Example:**
```javascript
describe('ViewForm', () => {
  it('should load form by ID from URL', async () => {
    // Arrange: Mock API with form data
    // Act: Navigate to /form/123
    // Assert: Form displayed correctly
  });
});
```

### 5. API Services (`api.js`)

**Test Cases:**
- ✅ `getToken()` retrieves token from storage
- ✅ `setToken()` stores token correctly
- ✅ `removeToken()` clears token
- ✅ `apiGet()` includes auth token in headers
- ✅ `apiPost()` sends data correctly
- ✅ Handles 401 errors (redirects to login)
- ✅ Parses validation errors correctly

**Example:**
```javascript
describe('API Services', () => {
  it('should include auth token in request headers', () => {
    // Arrange: Set token
    // Act: Make API call
    // Assert: Authorization header present
  });
});
```

### 6. Utilities

#### `dataTransform.js`
- ✅ `apiToLocal()` transforms API response to local format
- ✅ Handles null/undefined values

#### `errorHandler.js`
- ✅ `formatErrorMessage()` formats error messages
- ✅ Handles validation errors
- ✅ Handles network errors

### 7. Shared Components

#### `Toast.jsx`
- ✅ Shows success/error messages
- ✅ Auto-dismisses after timeout
- ✅ Can be dismissed manually

#### `LoadingSpinner.jsx`
- ✅ Displays when loading is true
- ✅ Hides when loading is false

#### `CustomerDropdown.jsx`
- ✅ Loads and displays customers
- ✅ Filters customers by search
- ✅ Selects customer correctly

## Test Commands

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Coverage Goals

- **Unit Tests**: 70%+ coverage
- **Integration Tests**: Critical user flows
- **E2E Tests**: Authentication, form creation, form viewing

## Priority Order

1. **High Priority**: Authentication, API services, Form builder save/load
2. **Medium Priority**: Form list, search, filter, sort
3. **Low Priority**: UI components, utilities

## Mocking Strategy

- Mock API calls using `vi.mock()`
- Mock localStorage/sessionStorage
- Mock React Router navigation
- Mock FormEngine components

## Example Test File Structure

```
src/
  __tests__/
    components/
      pages/
        Login.test.jsx
        Home.test.jsx
        NewForm.test.jsx
        ViewForm.test.jsx
      shared/
        Toast.test.jsx
        CustomerDropdown.test.jsx
    services/
      api.test.js
    utils/
      dataTransform.test.js
      errorHandler.test.js
```

