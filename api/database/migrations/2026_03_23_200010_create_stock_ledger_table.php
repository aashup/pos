<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_ledger', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('item_id')->constrained('items');
            $table->foreignUuid('batch_id')->nullable()->constrained('batches')->nullOnDelete();
            $table->foreignUuid('godown_id')->constrained('godowns');
            $table->enum('type', [
                'purchase', 'purchase_return', 'purchase_reversal',
                'sale', 'sale_return', 'sale_reversal',
                'transfer_in', 'transfer_out',
                'adjustment', 'opening',
            ]);
            $table->datetime('date');
            $table->string('reference_type')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->decimal('quantity', 15, 3);
            $table->decimal('rate', 15, 2)->default(0);
            $table->decimal('value', 15, 2)->default(0);
            $table->text('narration')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            // NO softDeletes (append-only)

            $table->index(['item_id', 'godown_id']);
            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_ledger');
    }
};
