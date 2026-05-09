<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('financial_year_id')->constrained('financial_years');
            $table->string('voucher_number')->unique();
            $table->datetime('voucher_date');
            $table->enum('voucher_type', ['purchase', 'sales', 'payment', 'receipt', 'journal', 'contra', 'payroll']);
            $table->text('narration')->nullable();
            $table->string('source')->nullable()->comment('auto or manual');
            $table->string('reference_type')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->boolean('is_posted')->default(false);
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();

            $table->index(['reference_type', 'reference_id']);
        });

        Schema::create('voucher_lines', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->foreignUuid('ledger_id')->constrained('ledgers');
            $table->decimal('debit', 15, 2)->default(0);
            $table->decimal('credit', 15, 2)->default(0);
            $table->text('narration')->nullable();

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
        Schema::dropIfExists('voucher_lines');
        Schema::dropIfExists('vouchers');
    }
};
