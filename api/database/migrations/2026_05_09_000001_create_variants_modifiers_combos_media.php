<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Item Variants ────────────────────────────────────────────────────
        Schema::create('item_variants', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('item_id')->constrained('items')->cascadeOnDelete();
            $table->string('name', 100);                       // "Small", "Large", "Half", "Full"
            $table->decimal('price_override', 15, 2)->nullable(); // null = use item.selling_price
            $table->string('sku', 100)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        // ── Modifier Groups ──────────────────────────────────────────────────
        Schema::create('modifier_groups', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name', 100);                       // "Spice Level", "Toppings"
            $table->boolean('is_required')->default(false);
            $table->unsignedTinyInteger('min_selections')->default(0);
            $table->unsignedTinyInteger('max_selections')->default(1); // 1 = single-select
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        // ── Modifiers (options within a group) ───────────────────────────────
        Schema::create('modifiers', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('modifier_group_id')->constrained('modifier_groups')->cascadeOnDelete();
            $table->string('name', 100);                       // "Mild", "Extra Cheese"
            $table->decimal('price', 10, 2)->default(0);       // surcharge on top of item price
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        // ── Item ↔ Modifier Group pivot ──────────────────────────────────────
        Schema::create('item_modifier_groups', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('item_id')->constrained('items')->cascadeOnDelete();
            $table->foreignUuid('modifier_group_id')->constrained('modifier_groups')->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['item_id', 'modifier_group_id'], 'img_item_group_unique');
        });

        // ── Combos ───────────────────────────────────────────────────────────
        Schema::create('combos', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('name', 200);
            $table->text('description')->nullable();
            $table->decimal('price', 15, 2)->default(0);
            $table->decimal('cgst', 5, 2)->default(0);
            $table->decimal('sgst', 5, 2)->default(0);
            $table->decimal('igst', 5, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });

        // ── Combo ↔ Modifier Group pivot (combos can have modifier groups too) ─
        Schema::create('combo_modifier_groups', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('combo_id')->constrained('combos')->cascadeOnDelete();
            $table->foreignUuid('modifier_group_id')->constrained('modifier_groups')->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['combo_id', 'modifier_group_id'], 'cmg_combo_group_unique');
        });

        // ── Combo Items (what's in the bundle) ───────────────────────────────
        Schema::create('combo_items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('combo_id')->constrained('combos')->cascadeOnDelete();
            $table->foreignUuid('item_id')->constrained('items');
            $table->char('item_variant_id', 36)->nullable()->index(); // pin to specific variant
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // ── Media (polymorphic image gallery) ────────────────────────────────
        Schema::create('media', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->enum('entity_type', ['item', 'item_variant', 'combo', 'modifier_group']);
            $table->char('entity_id', 36)->index();
            $table->string('url');                             // public URL for display
            $table->string('storage_path');                   // server path for Storage::delete()
            $table->string('disk', 20)->default('public');    // Laravel filesystem disk
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_primary')->default(false);
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->index(['entity_type', 'entity_id'], 'media_entity_index');
        });

        // ── Sales Invoice Line Modifiers ─────────────────────────────────────
        Schema::create('sales_invoice_line_modifiers', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('sales_invoice_line_id')->constrained('sales_invoice_lines')->cascadeOnDelete();
            $table->char('modifier_id', 36)->index();
            $table->string('modifier_name', 100);              // snapshot at order time
            $table->decimal('price_at_time', 10, 2)->default(0); // snapshot (price may change later)
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_invoice_line_modifiers');
        Schema::dropIfExists('media');
        Schema::dropIfExists('combo_items');
        Schema::dropIfExists('combo_modifier_groups');
        Schema::dropIfExists('combos');
        Schema::dropIfExists('item_modifier_groups');
        Schema::dropIfExists('modifiers');
        Schema::dropIfExists('modifier_groups');
        Schema::dropIfExists('item_variants');
    }
};
