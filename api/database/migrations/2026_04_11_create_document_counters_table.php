<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_counters', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('financial_year_id');
            $table->enum('document_type', [
                'purchase_order',
                'sales_order',
                'purchase_invoice',
                'sales_invoice',
                'contra',
                'payment',
                'receipt',
                'journal',
                'purchase',
                'sales',
                'payroll',
                'kot',
            ]);
            $table->string('prefix', 50)->nullable();
            $table->integer('next_number')->default(1);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('financial_year_id')->references('id')->on('financial_years')->onDelete('cascade');
            $table->unique(['company_id', 'financial_year_id', 'document_type'], 'doc_counters_unique');
        });

        // ── Payroll ──────────────────────────────────────────────────────────

        Schema::create('departments', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('designations', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('employee_code')->nullable();
            $table->string('name');
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->datetime('date_of_birth')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->foreignUuid('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignUuid('designation_id')->nullable()->constrained('designations')->nullOnDelete();
            $table->datetime('joining_date');
            $table->enum('employment_type', ['permanent', 'contract', 'part_time'])->default('permanent');
            $table->string('bank_account_name')->nullable();
            $table->string('bank_account_no', 30)->nullable();
            $table->string('bank_ifsc', 15)->nullable();
            $table->string('bank_name')->nullable();
            $table->string('pan', 10)->nullable();
            $table->string('pf_number', 30)->nullable();
            $table->string('esi_number', 30)->nullable();
            $table->boolean('is_pf_applicable')->default(true);
            $table->boolean('is_esi_applicable')->default(true);
            $table->boolean('is_active')->default(true);
            $table->foreignUuid('salary_ledger_id')->nullable()->constrained('ledgers')->nullOnDelete();
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('salary_component_definitions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name');
            $table->enum('type', ['earning', 'deduction'])->default('earning');
            $table->boolean('is_active')->default(true);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('salary_structures', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->datetime('effective_from');
            $table->decimal('basic', 12, 2)->default(0);
            $table->decimal('hra', 12, 2)->default(0);
            $table->decimal('da', 12, 2)->default(0);
            $table->decimal('conveyance', 12, 2)->default(0);
            $table->decimal('medical', 12, 2)->default(0);
            $table->decimal('special_allowance', 12, 2)->default(0);
            $table->decimal('professional_tax', 8, 2)->default(0);
            $table->decimal('tds_amount', 10, 2)->default(0);
            $table->json('custom_components')->nullable();
            $table->boolean('is_active')->default(true);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
        });

        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->tinyInteger('month')->unsigned();
            $table->smallInteger('year')->unsigned();
            $table->tinyInteger('working_days')->default(26);
            $table->enum('status', ['draft', 'approved', 'paid'])->default('draft');
            $table->decimal('total_gross', 14, 2)->default(0);
            $table->decimal('total_deductions', 14, 2)->default(0);
            $table->decimal('total_net', 14, 2)->default(0);
            $table->decimal('total_pf_employer', 12, 2)->default(0);
            $table->decimal('total_esi_employer', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->foreignUuid('voucher_id')->nullable()->constrained('vouchers')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['company_id', 'month', 'year']);
        });

        Schema::create('ledger_closing_balances', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('financial_year_id')->constrained('financial_years')->cascadeOnDelete();
            $table->foreignUuid('ledger_id')->constrained('ledgers')->cascadeOnDelete();
            $table->decimal('closing_balance', 18, 2)->default(0);
            $table->enum('balance_type', ['dr', 'cr'])->default('dr');
            $table->timestamps();
            $table->unique(['financial_year_id', 'ledger_id'], 'lcb_fy_ledger_unique');
        });

        // ── Restaurant POS ───────────────────────────────────────────────────

        Schema::create('floor_plans', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name', 100);
            $table->integer('sort_order')->default(0);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('dining_tables', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('floor_plan_id')->nullable()->constrained('floor_plans')->nullOnDelete();
            $table->string('name', 20);
            $table->tinyInteger('capacity')->default(4);
            $table->enum('shape', ['square', 'round', 'rectangle'])->default('square');
            $table->smallInteger('pos_x')->default(0);
            $table->smallInteger('pos_y')->default(0);
            $table->enum('status', ['vacant', 'occupied', 'reserved', 'cleaning'])->default('vacant');
            $table->char('current_order_id', 36)->nullable();
            $table->boolean('is_active')->default(true);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('kots', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->char('sales_invoice_id', 36)->nullable()->index();
            $table->char('order_session_id', 36)->nullable()->index();
            $table->string('kot_number', 20);
            $table->enum('status', ['new', 'in_progress', 'ready', 'served'])->default('new');
            $table->text('notes')->nullable();
            $table->tinyInteger('print_count')->default(0);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('kot_lines', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('kot_id')->constrained('kots')->cascadeOnDelete();
            $table->foreignUuid('item_id')->constrained('items');
            $table->string('item_name', 200);
            $table->string('variant_name', 100)->nullable();
            $table->string('modifier_summary', 500)->nullable();
            $table->decimal('quantity', 10, 2);
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'cooking', 'ready'])->default('pending');
            $table->timestamps();
        });

        Schema::create('recipes', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('item_id')->constrained('items')->cascadeOnDelete();
            $table->string('variant_label', 100)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('recipe_ingredients', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('recipe_id')->constrained('recipes')->cascadeOnDelete();
            $table->foreignUuid('item_id')->constrained('items');
            $table->decimal('quantity', 10, 4);
            $table->string('unit', 20)->nullable();
            $table->timestamps();
        });

        // ── Payroll ──────────────────────────────────────────────────────────

        Schema::create('payroll_entries', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees');
            $table->tinyInteger('present_days')->default(0);
            $table->decimal('basic', 12, 2)->default(0);
            $table->decimal('hra', 12, 2)->default(0);
            $table->decimal('da', 12, 2)->default(0);
            $table->decimal('conveyance', 12, 2)->default(0);
            $table->decimal('medical', 12, 2)->default(0);
            $table->decimal('special_allowance', 12, 2)->default(0);
            $table->decimal('gross_salary', 14, 2)->default(0);
            $table->decimal('pf_employee', 10, 2)->default(0);
            $table->decimal('esi_employee', 10, 2)->default(0);
            $table->decimal('professional_tax', 8, 2)->default(0);
            $table->decimal('tds', 10, 2)->default(0);
            $table->decimal('total_deductions', 14, 2)->default(0);
            $table->decimal('net_salary', 14, 2)->default(0);
            $table->decimal('pf_employer', 10, 2)->default(0);
            $table->decimal('esi_employer', 10, 2)->default(0);
            $table->json('custom_components')->nullable();
            $table->boolean('is_paid')->default(false);
            $table->foreignUuid('payment_voucher_id')->nullable()->constrained('vouchers')->nullOnDelete();
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_entries');
        Schema::dropIfExists('payroll_runs');
        Schema::dropIfExists('ledger_closing_balances');
        Schema::dropIfExists('salary_structures');
        Schema::dropIfExists('salary_component_definitions');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('designations');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('recipe_ingredients');
        Schema::dropIfExists('recipes');
        Schema::dropIfExists('kot_lines');
        Schema::dropIfExists('kots');
        Schema::dropIfExists('dining_tables');
        Schema::dropIfExists('floor_plans');
        Schema::dropIfExists('document_counters');
    }
};
