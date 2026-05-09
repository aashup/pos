<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('value'); // PCS, KG, BOX, etc.
            $table->string('label'); // Pieces, Kilograms, Box, etc.
            $table->enum('status', ['active', 'inactive'])->default('active');

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();

            // Unique constraint scoped by company
            $table->unique(['company_id', 'value']);
        });

        Schema::create('item_groups', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('parent_id')->nullable()->constrained('item_groups')->nullOnDelete();
            $table->string('name');
            $table->boolean('is_active')->default(true);

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('item_group_id')->nullable()->constrained('item_groups')->nullOnDelete();
            $table->string('name');
            $table->string('sku')->nullable();
            $table->string('hsn_code')->nullable();
            $table->string('unit'); // e.g. PCS, KG, BOX, STRIP — base/stock unit
            $table->decimal('igst', 5, 2)->default(0);
            $table->decimal('sgst', 5, 2)->default(0);
            $table->decimal('cgst', 5, 2)->default(0);
            $table->decimal('mrp', 15, 2)->nullable();
            $table->decimal('purchase_price', 15, 2)->nullable();
            $table->decimal('selling_price', 15, 2)->nullable();
            $table->integer('reorder_level')->default(0);
            $table->boolean('is_batch_tracked')->default(false);
            $table->boolean('is_active')->default(true);

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('item_alternate_units', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('item_id')->constrained('items')->cascadeOnDelete();
            $table->string('unit', 20);                          // e.g. STRIP, BOX
            $table->decimal('conversion_factor', 15, 4);         // 1 of this unit = N base units
            $table->decimal('selling_price', 15, 2)->nullable(); // override selling price for this unit
            $table->boolean('is_default_purchase')->default(false);
            $table->boolean('is_default_sale')->default(false);

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['item_id', 'unit']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('item_alternate_units');
        Schema::dropIfExists('items');
        Schema::dropIfExists('item_groups');
        Schema::dropIfExists('units');
    }
};
