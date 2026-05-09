<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_invoices', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('financial_year_id')->nullable()->constrained('financial_years')->nullOnDelete();
            $table->foreignUuid('party_id')->nullable()->constrained('parties')->nullOnDelete();
            $table->foreignUuid('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignUuid('sales_order_id')->nullable()->constrained('sales_orders')->nullOnDelete();
            $table->foreignUuid('godown_id')->nullable()->constrained('godowns')->nullOnDelete();
            $table->string('invoice_number')->unique();
            $table->datetime('invoice_date');
            $table->datetime('due_date')->nullable();
            $table->boolean('is_inter_state')->default(false);
            $table->boolean('is_printed')->default(false);
            $table->enum('status', ['draft', 'confirmed', 'cancelled'])->default('draft');
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('taxable_amount', 15, 2)->default(0);
            $table->decimal('cgst_total', 15, 2)->default(0);
            $table->decimal('sgst_total', 15, 2)->default(0);
            $table->decimal('igst_total', 15, 2)->default(0);
            $table->decimal('grand_total', 15, 2)->default(0);
            $table->decimal('round_off', 15, 2)->default(0);
            $table->decimal('amount_paid', 15, 2)->default(0);
            $table->decimal('balance_due', 15, 2)->default(0);
            $table->text('notes')->nullable();
            // Restaurant POS fields
            $table->enum('order_type', ['dine_in', 'takeaway', 'delivery'])->default('takeaway');
            $table->char('table_id', 36)->nullable()->index();
            $table->smallInteger('pax')->default(1);
            $table->tinyInteger('kot_count')->default(0);
            $table->boolean('pos_held')->default(false);
            $table->string('pos_payment_mode', 20)->nullable();
            $table->string('share_token', 64)->nullable()->unique();
            $table->decimal('amount_tendered', 15, 2)->default(0);
            $table->decimal('change_amount', 15, 2)->default(0);
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('sales_invoice_lines', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('sales_invoice_id')->constrained('sales_invoices')->cascadeOnDelete();
            $table->foreignUuid('item_id')->constrained('items');
            $table->foreignUuid('batch_id')->nullable()->constrained('batches')->nullOnDelete();
            $table->decimal('quantity', 15, 3);
            $table->string('unit', 20)->nullable();                     // selected unit (null = item base unit)
            $table->decimal('conversion_factor', 15, 4)->default(1.0000); // 1 if base unit
            $table->decimal('rate', 15, 2);
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('taxable_amount', 15, 2)->default(0);
            $table->decimal('gst_rate', 5, 2)->default(0);
            $table->decimal('cgst', 15, 2)->default(0);
            $table->decimal('sgst', 15, 2)->default(0);
            $table->decimal('igst', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2)->default(0);
            $table->enum('kot_status', ['pending', 'sent', 'cooking', 'ready', 'served'])->default('pending');
            $table->text('notes')->nullable();
            $table->foreignUuid('godown_id')->nullable()->constrained('godowns')->nullOnDelete();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_invoice_lines');
        Schema::dropIfExists('sales_invoices');
    }
};
