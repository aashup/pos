<?php

use App\Http\Controllers\Api\V1\AccountingGroupController;
use App\Http\Controllers\Api\V1\DiningTableController;
use App\Http\Controllers\Api\V1\RecipeController;
use App\Http\Controllers\Api\V1\FloorPlanController;
use App\Http\Controllers\Api\V1\KotController;
use App\Http\Controllers\Api\V1\RestaurantOrderController;
use App\Http\Controllers\Api\V1\RestaurantReportController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ImpersonationController;
use App\Http\Controllers\Api\V1\BatchController;
use App\Http\Controllers\Api\V1\DocumentCounterController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\CompanyController;
use App\Http\Controllers\Api\V1\CompanySettingController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DepartmentController;
use App\Http\Controllers\Api\V1\DesignationController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\FinancialYearController;
use App\Http\Controllers\Api\V1\GodownController;
use App\Http\Controllers\Api\V1\InvoiceTemplateController;
use App\Http\Controllers\Api\V1\ItemController;
use App\Http\Controllers\Api\V1\ItemGroupController;
use App\Http\Controllers\Api\V1\LedgerController;
use App\Http\Controllers\Api\V1\PartyController;
use App\Http\Controllers\Api\V1\PaymentReceiptController;
use App\Http\Controllers\Api\V1\PayrollController;
use App\Http\Controllers\Api\V1\PublicInvoiceController;
use App\Http\Controllers\Api\V1\PurchaseInvoiceController;
use App\Http\Controllers\Api\V1\PurchaseOrderController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SalaryComponentDefinitionController;
use App\Http\Controllers\Api\V1\SalaryStructureController;
use App\Http\Controllers\Api\V1\SalesInvoiceController;
use App\Http\Controllers\Api\V1\SalesOrderController;
use App\Http\Controllers\Api\V1\StockLedgerController;
use App\Http\Controllers\Api\V1\SyncController;
use App\Http\Controllers\Api\V1\ThermalTemplateController;
use App\Http\Controllers\Api\V1\UnitController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\VoucherController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/
Route::get('/health', fn() => response()->json(['ok' => true, 'app' => 'Zazzy POS']));

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Public invoice share (no auth — WhatsApp/social preview)
Route::get('/public/invoices/{token}', [PublicInvoiceController::class, 'show']);

/*
|--------------------------------------------------------------------------
| Protected Routes (Sanctum)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/chart', [DashboardController::class, 'chart']);
    Route::get('/dashboard/collection', [DashboardController::class, 'collection']);

    // Auth
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/profile/avatar', [AuthController::class, 'uploadAvatar']);
    Route::put('/auth/password', [AuthController::class, 'updatePassword']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/logout-all', [AuthController::class, 'logoutAll']);

    // Sync
    Route::post('/sync/push', [SyncController::class, 'push']);
    Route::get('/sync/pull', [SyncController::class, 'pull']);

    // Inventory
    Route::apiResource('units', UnitController::class);
    Route::apiResource('item-groups', ItemGroupController::class);
    Route::apiResource('items', ItemController::class);
    Route::apiResource('godowns', GodownController::class);

    // Stock Ledger & Inventory Operations
    Route::get('stock-ledger', [StockLedgerController::class, 'index']);
    Route::get('stock-summary', [StockLedgerController::class, 'summary']);
    Route::post('stock-ledger/opening', [StockLedgerController::class, 'opening']);
    Route::post('stock-ledger/adjustment', [StockLedgerController::class, 'adjustment']);
    Route::post('stock-ledger/transfer', [StockLedgerController::class, 'transfer']);
    Route::get('stock-ledger/reorder-alerts', [StockLedgerController::class, 'reorderAlerts']);
    Route::get('items/{item}/movements', [StockLedgerController::class, 'itemMovements']);

    // Batches
    Route::get('batches', [BatchController::class, 'allBatches']);
    Route::get('batches/expiring', [BatchController::class, 'expiring']);
    Route::get('items/{item}/batches', [BatchController::class, 'index']);
    Route::post('items/{item}/batches', [BatchController::class, 'store']);
    Route::put('batches/{batch}', [BatchController::class, 'update']);
    Route::delete('batches/{batch}', [BatchController::class, 'destroy']);

    // Parties
    Route::get('parties/{party}/balance', [PartyController::class, 'balance']);
    Route::apiResource('parties', PartyController::class);

    // Branches
    Route::apiResource('branches', BranchController::class);

    // Users & Roles
    Route::apiResource('users', UserController::class);
    Route::apiResource('roles', RoleController::class);
    Route::get('permissions', [RoleController::class, 'permissions']);

    // Xtrox super-admin impersonation
    Route::post('admin/impersonate/{user}', [ImpersonationController::class, 'impersonate']);
    Route::delete('admin/impersonate/{user}', [ImpersonationController::class, 'stopImpersonating']);

    // Purchase
    Route::patch('purchase-orders/{purchase_order}/status', [PurchaseOrderController::class, 'updateStatus']);
    Route::post('purchase-orders/{purchase_order}/receive', [PurchaseOrderController::class, 'receive']);
    Route::apiResource('purchase-orders', PurchaseOrderController::class);
    Route::post('purchase-invoices/bulk-cancel', [PurchaseInvoiceController::class, 'bulkCancel']);
    Route::apiResource('purchase-invoices', PurchaseInvoiceController::class);
    // Sales
    Route::patch('sales-orders/{sales_order}/status', [SalesOrderController::class, 'updateStatus']);
    Route::apiResource('sales-orders', SalesOrderController::class);
    Route::get('sales-invoices/{sales_invoice}/pdf', [SalesInvoiceController::class, 'pdf']);
    Route::get('sales-invoices/{sales_invoice}/html', [SalesInvoiceController::class, 'html']);
    Route::patch('sales-invoices/{sales_invoice}/status', [SalesInvoiceController::class, 'updateStatus']);
    Route::post('sales-invoices/bulk-cancel', [SalesInvoiceController::class, 'bulkCancel']);
    Route::apiResource('sales-invoices', SalesInvoiceController::class);

    // Company
    Route::get('companies/{company}', [CompanyController::class, 'show']);
    Route::put('companies/{company}', [CompanyController::class, 'update']);
    Route::post('companies/{company}/logo', [CompanyController::class, 'uploadLogo']);

    // Invoice Templates & Company Settings
    Route::get('invoice-templates', [InvoiceTemplateController::class, 'index']);
    Route::post('thermal-templates/load-defaults', [ThermalTemplateController::class, 'loadDefaults']);
    Route::patch('thermal-templates/{thermal_template}/set-default', [ThermalTemplateController::class, 'setDefault']);
    Route::apiResource('thermal-templates', ThermalTemplateController::class);
    Route::get('company-settings', [CompanySettingController::class, 'index']);
    Route::put('company-settings', [CompanySettingController::class, 'update']);

    // Financial Years
    Route::patch('financial-years/{financial_year}/set-current', [FinancialYearController::class, 'setCurrent']);
    Route::apiResource('financial-years', FinancialYearController::class);

    // Document Counters
    Route::get('document-counters', [DocumentCounterController::class, 'index']);
    Route::put('document-counters/{documentCounter}', [DocumentCounterController::class, 'update']);

    // Accounting
    Route::post('accounting-groups/load-defaults', [AccountingGroupController::class, 'loadDefaults']);
    Route::apiResource('accounting-groups', AccountingGroupController::class);
    Route::get('ledgers/{ledger}/balance', [LedgerController::class, 'balance']);
    Route::apiResource('ledgers', LedgerController::class);
    Route::apiResource('vouchers', VoucherController::class)->except(['update']);
    Route::get('payment-receipts/{payment_receipt}/journal', [PaymentReceiptController::class, 'journal']);
    Route::apiResource('payment-receipts', PaymentReceiptController::class)->except(['update']);

    // Payroll
    Route::apiResource('departments', DepartmentController::class);
    Route::apiResource('designations', DesignationController::class);
    Route::get('employees/{employee}/salary-structure', [EmployeeController::class, 'salaryStructure']);
    Route::post('employees/{employee}/salary-structure', [SalaryStructureController::class, 'storeForEmployee']);
    Route::get('employees/{employee}/advance-balance', [EmployeeController::class, 'advanceBalance']);
    Route::post('employees/{employee}/advance', [EmployeeController::class, 'payAdvance']);
    Route::apiResource('salary-structures', SalaryStructureController::class)->only(['show', 'update', 'destroy']);
    Route::apiResource('salary-component-definitions', SalaryComponentDefinitionController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('employees', EmployeeController::class);
    Route::post('payroll-runs/generate', [PayrollController::class, 'generate']);
    Route::patch('payroll-runs/{payrollRun}/approve', [PayrollController::class, 'approve']);
    Route::patch('payroll-runs/{payrollRun}/mark-paid', [PayrollController::class, 'markPaid']);
    Route::patch('payroll-runs/{payrollRun}/entries/{entry}', [PayrollController::class, 'updateEntry']);
    Route::get('payroll-runs/{payrollRun}/payslip/{employee}', [PayrollController::class, 'payslip']);
    Route::get('payroll-runs', [PayrollController::class, 'index']);
    Route::get('payroll-runs/{payrollRun}', [PayrollController::class, 'show']);
    Route::delete('payroll-runs/{payrollRun}', [PayrollController::class, 'destroy']);

    // Restaurant — Floor Plans & Tables
    Route::apiResource('floor-plans', FloorPlanController::class);
    Route::patch('dining-tables/{dining_table}/status', [DiningTableController::class, 'updateStatus']);
    Route::post('dining-tables/{dining_table}/merge', [DiningTableController::class, 'merge']);
    Route::apiResource('dining-tables', DiningTableController::class);

    // Restaurant — Orders
    Route::post('restaurant/orders/{order}/lines', [RestaurantOrderController::class, 'addLines']);
    Route::delete('restaurant/orders/{order}/lines/{line}', [RestaurantOrderController::class, 'removeLine']);
    Route::post('restaurant/orders/{order}/kot', [RestaurantOrderController::class, 'generateKot']);
    Route::post('restaurant/orders/{order}/hold', [RestaurantOrderController::class, 'hold']);
    Route::post('restaurant/orders/{order}/unhold', [RestaurantOrderController::class, 'unhold']);
    Route::post('restaurant/orders/{order}/checkout', [RestaurantOrderController::class, 'checkout']);
    Route::post('restaurant/orders/{order}/cancel', [RestaurantOrderController::class, 'cancel']);
    Route::post('restaurant/orders/{order}/transfer-table', [RestaurantOrderController::class, 'transferTable']);
    Route::get('restaurant/orders', [RestaurantOrderController::class, 'index']);
    Route::post('restaurant/orders', [RestaurantOrderController::class, 'store']);
    Route::get('restaurant/orders/{order}', [RestaurantOrderController::class, 'show']);

    // Recipes
    Route::apiResource('recipes', RecipeController::class);

    // Restaurant — KOTs (Kitchen Order Tickets)
    Route::patch('kots/{kot}/status', [KotController::class, 'updateStatus']);
    Route::patch('kots/{kot}/lines/{line}/status', [KotController::class, 'updateLineStatus']);
    Route::post('kots/{kot}/reprint', [KotController::class, 'reprint']);
    Route::get('kots', [KotController::class, 'index']);
    Route::get('kots/{kot}', [KotController::class, 'show']);

    // Reports
    // Restaurant POS reports
    Route::get('reports/sales-summary', [RestaurantReportController::class, 'salesSummary']);
    Route::get('reports/item-wise',     [RestaurantReportController::class, 'itemWise']);
    Route::get('reports/day-close',     [RestaurantReportController::class, 'dayClose']);
    Route::get('reports/gst-summary',   [RestaurantReportController::class, 'gstSummary']);
    Route::get('reports/payment-mode',  [RestaurantReportController::class, 'paymentMode']);

    Route::get('reports/trial-balance', [ReportController::class, 'trialBalance']);
    Route::get('reports/profit-and-loss', [ReportController::class, 'profitAndLoss']);
    Route::get('reports/balance-sheet', [ReportController::class, 'balanceSheet']);
    Route::get('reports/party-ledger', [ReportController::class, 'partyLedger']);
    Route::get('reports/ledger-transactions', [ReportController::class, 'ledgerTransactions']);
    Route::get('reports/cash-book', [ReportController::class, 'cashBook']);
    Route::get('reports/bank-book', [ReportController::class, 'bankBook']);
    Route::get('reports/day-book', [ReportController::class, 'dayBook']);
    Route::get('reports/audit-trail/filters', [ReportController::class, 'auditTrailFilters']);
    Route::get('reports/audit-trail', [ReportController::class, 'auditTrail']);
});
