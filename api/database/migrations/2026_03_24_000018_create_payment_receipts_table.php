<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_receipts', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('party_id')->constrained('parties');
            $table->enum('type', ['payment', 'receipt']);
            $table->string('receipt_number')->unique();
            $table->datetime('receipt_date');
            $table->decimal('amount', 15, 2);
            $table->enum('payment_mode', ['cash', 'bank', 'cheque', 'upi', 'other'])->default('cash');
            $table->string('reference_number')->nullable();
            $table->string('bank_name')->nullable();
            $table->text('notes')->nullable();
            $table->foreignUuid('purchase_invoice_id')->nullable()->constrained('purchase_invoices')->nullOnDelete();
            $table->foreignUuid('sales_invoice_id')->nullable()->constrained('sales_invoices')->nullOnDelete();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_receipts');
    }
};
