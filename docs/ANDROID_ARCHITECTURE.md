# CrediPOS — Android Native Architecture & Integration Specification

This document provides the blueprint for building the future native Android application for **CrediPOS**, sharing the identical backend REST API and SQLite/PostgreSQL relational data store.

---

## 1. Architectural Overview

```
┌────────────────────────────────────────────────────────┐
│                   UI Layer (Jetpack Compose)            │
│  - Screen Composables (PosScreen, CreditScreen, etc.)   │
│  - StateHolders (PosViewModel, CreditViewModel)         │
│  - StateFlow / SharedFlow UI events                    │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Domain Layer                        │
│  - Use Cases (ProcessSaleUseCase, RepayCreditUseCase)  │
│  - Pure Domain Models (Money, Product, CreditAccount)  │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                     Data Layer                         │
│  - PosRepository & CreditRepository implementations     │
│  - Retrofit / Ktor Remote DataSource (/api/*)          │
│  - Room Local Cache (Master data & sync queues)        │
│  - DataStore (Session tokens, active business profile) │
└────────────────────────────────────────────────────────┘
```

- **Pattern**: MVVM + Repository Pattern with unidirectional data flow (UDF).
- **Tooling**:
  - UI: **Jetpack Compose** + Material 3.
  - Concurrency: **Kotlin Coroutines** + **Flow**.
  - Networking: **Retrofit 2** or **Ktor Client** with `kotlinx.serialization` or `Moshi`.
  - Persistence: **Room Database** (local read cache).
  - Dependency Injection: **Hilt** / **Koin**.

---

## 2. API Contract & Retrofit Interface

The Android app consumes the exact same REST endpoints as the web client, running under `/api/*`.

```kotlin
package com.credipos.data.remote

import retrofit2.Response
import retrofit2.http.*

interface CrediPosApiService {

    // --- Authentication & Store Profile ---
    @GET("api/auth/me")
    suspend fun getCurrentUser(): Response<UserResponse>

    @GET("api/business")
    suspend fun getBusinessProfile(): Response<BusinessProfileResponse>

    // --- Products & Categories ---
    @GET("api/products")
    suspend fun getProducts(): Response<ProductListResponse>

    @GET("api/categories")
    suspend fun getCategories(): Response<CategoryListResponse>

    // --- Customers & Credit Accounts ---
    @GET("api/customers")
    suspend fun getCustomers(): Response<CustomerListResponse>

    @POST("api/customers")
    suspend fun createCustomer(@Body request: CreateCustomerRequest): Response<CustomerResponse>

    @GET("api/credits/aging")
    suspend fun getCreditAging(): Response<CreditAgingResponse>

    @GET("api/credits/accounts")
    suspend fun getCreditAccounts(): Response<CreditAccountsResponse>

    @POST("api/credits/payments")
    suspend fun recordCreditRepayment(@Body request: CreditRepaymentRequest): Response<CreditRepaymentResponse>

    // --- Transactions & POS Checkout ---
    @POST("api/sales")
    suspend fun processSale(@Body request: ProcessSaleRequest): Response<SaleTransactionResponse>

    @GET("api/sales")
    suspend fun getSalesHistory(@Query("limit") limit: Int = 50): Response<SalesHistoryResponse>

    // --- Dashboard & Analytics ---
    @GET("api/dashboard")
    suspend fun getDashboardSummary(): Response<DashboardResponse>
}
```

---

## 3. Data Transfer Objects (DTOs)

Authoritative financial data is sent with exact numeric types:

```kotlin
package com.credipos.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class ProcessSaleRequest(
    val customer_id: String? = null,
    val items: List<SaleItemRequest>,
    val transaction_discount: Long = 0L,
    val payment_type: String, // "cash", "qris", "bank_transfer", "ewallet", "partial", "credit"
    val amount_paid: Long,
    val due_date: String? = null, // "YYYY-MM-DD"
    val notes: String? = null
)

@Serializable
data class SaleItemRequest(
    val product_id: String,
    val quantity: Int,
    val discount: Long = 0L
)

@Serializable
data class CreditRepaymentRequest(
    val credit_account_id: String,
    val amount: Long,
    val payment_method: String = "cash",
    val notes: String? = null
)
```

---

## 4. Local Persistence & Offline Integrity Strategy

Per CrediPOS design guidelines:
1. **Master Data Cache**: Products, categories, and customer directories are cached in Room for instant UI rendering and fast barcode searching.
2. **Offline Safety**: 
   - Write operations (sales checkout, credit debt repayments) are **never processed silently in offline state**.
   - If connectivity drops, the app displays a prominent `OfflineBanner` and disables checkout submission.
   - Authoritative financial logic, credit limits, discounts, and inventory balances are always calculated and validated on the backend.
3. **Room Database Entities**:

```kotlin
@Entity(tableName = "cached_products")
data class ProductEntity(
    @PrimaryKey val id: String,
    val business_id: String,
    val name: String,
    val sku: String,
    val barcode: String,
    val selling_price: Long,
    val current_stock: Int,
    val unit: String
)
```

---

## 5. Device-Specific Features (Android Native)

1. **Bluetooth ESC/POS Receipt Printer**:
   - Uses `BluetoothAdapter` and RFCOMM socket (`UUID 00001101-0000-1000-8000-00805F9B34FB`) to print standard 58mm/80mm receipts directly upon `SaleTransactionResponse`.
2. **Camera Barcode Scanner**:
   - Integrates Google ML Kit Barcode Scanning via CameraX for high-speed continuous SKU scanning.
