<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ledgers', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->foreignUuid('company_id')->constrained('companies')->preventOnDelete();

            // Core Identity
            $table->string('name');
            $table->string('alias')->nullable();

            // Classification
            $table->foreignUuid('group_id')->constrained('accounting_groups');

            // Opening Balance
            $table->decimal('opening_balance', 18, 2)->default(0);
            $table->enum('opening_type', ['dr', 'cr'])->default('dr');
            $table->datetime('opening_date')->nullable();

            // Behavior Flags
            $table->boolean('is_bill_wise')->default(false);
            $table->boolean('is_cost_center_applicable')->default(false);

            // Control Flags
            $table->boolean('allow_manual_entry')->default(true);
            $table->boolean('is_system')->default(false);
            $table->string('system_key')->nullable();

            // Polymorphic Relation
            $table->string('ledgerable_type')->nullable();
            $table->uuid('ledgerable_id')->nullable();

            // Audit
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();

            // Sync columns
            $table->enum('sync_status', ['pending', 'synced', 'conflict'])->default('pending');
            $table->string('device_id', 255)->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('updated_at_local')->useCurrent();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['ledgerable_type', 'ledgerable_id']);
            $table->unique(['company_id', 'system_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledgers');
    }
};
