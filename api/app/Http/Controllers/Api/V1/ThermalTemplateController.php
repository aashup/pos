<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ThermalTemplate;
use App\Services\ThermalTemplateDefaults;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ThermalTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', ThermalTemplate::class);

        $query = ThermalTemplate::where('company_id', $request->user()->company_id)
            ->orderBy('paper_size')
            ->orderBy('is_default', 'desc')
            ->orderBy('created_at', 'desc');

        if ($request->filled('template_type')) {
            $query->where('template_type', $request->template_type);
        }

        return response()->json($query->paginate($request->per_page ?? 25));
    }

    public function show(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('view', $thermalTemplate);

        return response()->json(['data' => $thermalTemplate]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', ThermalTemplate::class);

        $validated = $request->validate([
            'name'          => 'required|string|max:255',
            'html_content'  => 'required|string|max:102400',
            'paper_size'    => ['required', Rule::in(['2inch', '3inch'])],
            'template_type' => 'required|string|max:50',
            'is_default'    => 'boolean',
        ]);

        if ($validated['is_default'] ?? false) {
            $this->unsetDefaults(
                $request->user()->company_id,
                $validated['paper_size'],
                $validated['template_type']
            );
        }

        $template = ThermalTemplate::create([
            'company_id' => $request->user()->company_id,
            'created_by' => $request->user()->id,
            ...$validated,
        ]);

        return response()->json(['data' => $template], 201);
    }

    public function update(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('update', $thermalTemplate);

        $validated = $request->validate([
            'name'          => 'string|max:255',
            'html_content'  => 'string|max:102400',
            'paper_size'    => [Rule::in(['2inch', '3inch'])],
            'template_type' => 'string|max:50',
            'is_default'    => 'boolean',
        ]);

        if ($validated['is_default'] ?? false) {
            $paperSize    = $validated['paper_size']    ?? $thermalTemplate->paper_size;
            $templateType = $validated['template_type'] ?? $thermalTemplate->template_type;
            $this->unsetDefaults(
                $thermalTemplate->company_id,
                $paperSize,
                $templateType,
                $thermalTemplate->id
            );
        }

        $thermalTemplate->update([
            'updated_by' => $request->user()->id,
            ...$validated,
        ]);

        $thermalTemplate->refresh();

        return response()->json(['data' => $thermalTemplate]);
    }

    public function destroy(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('delete', $thermalTemplate);

        $defaultCount = ThermalTemplate::where('company_id', $thermalTemplate->company_id)
            ->where('paper_size', $thermalTemplate->paper_size)
            ->where('template_type', $thermalTemplate->template_type)
            ->where('is_default', true)
            ->count();

        if ($thermalTemplate->is_default && $defaultCount === 1) {
            return response()->json(
                ['message' => 'Cannot delete the only default template for this paper size and type.'],
                422
            );
        }

        $thermalTemplate->delete();

        return response()->json(['message' => 'Thermal template deleted']);
    }

    public function setDefault(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('update', $thermalTemplate);

        $this->unsetDefaults(
            $thermalTemplate->company_id,
            $thermalTemplate->paper_size,
            $thermalTemplate->template_type,
            $thermalTemplate->id
        );

        $thermalTemplate->update([
            'is_default' => true,
            'updated_by' => $request->user()->id,
        ]);

        $thermalTemplate->refresh();

        return response()->json(['data' => $thermalTemplate]);
    }

    /**
     * Seed built-in default templates (invoice + kot) × (2inch + 3inch).
     * Skips any combination that already has a default.
     */
    public function loadDefaults(Request $request): JsonResponse
    {
        $this->authorize('create', ThermalTemplate::class);

        $companyId = $request->user()->company_id;
        $userId    = $request->user()->id;
        $created   = [];

        $sizes = ThermalTemplateDefaults::sizes();

        foreach ($sizes as $paperSize => $cfg) {
            // Invoice default
            if (! $this->defaultExists($companyId, $paperSize, 'invoice')) {
                ThermalTemplate::create([
                    'company_id'    => $companyId,
                    'name'          => "Default Invoice {$paperSize}",
                    'html_content'  => $this->buildInvoiceHtml($cfg),
                    'paper_size'    => $paperSize,
                    'template_type' => 'invoice',
                    'is_default'    => true,
                    'created_by'    => $userId,
                ]);
                $created[] = "invoice/{$paperSize}";
            }

            // KOT default
            if (! $this->defaultExists($companyId, $paperSize, 'kot')) {
                ThermalTemplate::create([
                    'company_id'    => $companyId,
                    'name'          => "Default KOT {$paperSize}",
                    'html_content'  => $this->buildKotHtml($cfg),
                    'paper_size'    => $paperSize,
                    'template_type' => 'kot',
                    'is_default'    => true,
                    'created_by'    => $userId,
                ]);
                $created[] = "kot/{$paperSize}";
            }
        }

        return response()->json([
            'data'    => ['created' => $created],
            'message' => count($created)
                ? 'Default templates created: '.implode(', ', $created)
                : 'Default templates already exist for all paper sizes and types.',
        ]);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function unsetDefaults(
        string $companyId,
        string $paperSize,
        string $templateType,
        ?string $excludeId = null
    ): void {
        $query = ThermalTemplate::where('company_id', $companyId)
            ->where('paper_size', $paperSize)
            ->where('template_type', $templateType)
            ->where('is_default', true);

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        $query->update(['is_default' => false]);
    }

    private function defaultExists(string $companyId, string $paperSize, string $templateType): bool
    {
        return ThermalTemplate::where('company_id', $companyId)
            ->where('paper_size', $paperSize)
            ->where('template_type', $templateType)
            ->where('is_default', true)
            ->exists();
    }

    private function buildKotHtml(array $cfg): string
    {
        return ThermalTemplateDefaults::buildKotHtml($cfg);
    }

    private function buildInvoiceHtml(array $cfg): string
    {
        return ThermalTemplateDefaults::buildInvoiceHtml($cfg);
    }
}
