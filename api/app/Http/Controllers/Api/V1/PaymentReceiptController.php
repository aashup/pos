<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Party;
use App\Models\PaymentReceipt;
use App\Models\PurchaseInvoice;
use App\Models\SalesInvoice;
use App\Models\Voucher;
use App\Services\AccountingService;
use App\Traits\FiltersByFinancialYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentReceiptController extends Controller
{
    use FiltersByFinancialYear;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', PaymentReceipt::class);

        $query = PaymentReceipt::with('party')
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->search, fn ($q, $s) => $q->where('receipt_number', 'like', "%{$s}%"))
            ->when($request->date_from, fn ($q, $d) => $q->whereDate('receipt_date', '>=', $d))
            ->when($request->date_to, fn ($q, $d) => $q->whereDate('receipt_date', '<=', $d))
            ->latest('receipt_date');

        $this->applyFYFilter($query, $request, 'receipt_date');

        $receipts = $query->paginate($request->per_page ?? 25);

        return response()->json($receipts);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', PaymentReceipt::class);

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'type' => 'required|in:payment,receipt',
            'receipt_number' => 'required|string|unique:payment_receipts',
            'receipt_date' => 'required|date',
            'amount' => 'required|numeric|min:0.01',
            'payment_mode' => 'required|in:cash,bank,cheque,upi,other',
            'reference_number' => 'nullable|string',
            'bank_name' => 'nullable|string',
            'notes' => 'nullable|string',
            'purchase_invoice_id' => 'nullable|uuid|exists:purchase_invoices,id',
            'sales_invoice_id' => 'nullable|uuid|exists:sales_invoices,id',
        ]);

        $receipt = PaymentReceipt::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        // Auto-post journal entry
        $party = Party::find($validated['party_id']);
        if ($party) {
            $accountingService = app(AccountingService::class);
            $narration = "{$validated['type']} #{$receipt->receipt_number} — {$party->name}";

            if ($validated['type'] === 'payment') {
                $accountingService->postPayment(
                    $request->user()->company_id,
                    $party,
                    (float) $validated['amount'],
                    $validated['payment_mode'],
                    $validated['receipt_date'],
                    $narration,
                    $request->user()->id,
                    PaymentReceipt::class,
                    $receipt->id,
                );
            } else {
                $accountingService->postReceipt(
                    $request->user()->company_id,
                    $party,
                    (float) $validated['amount'],
                    $validated['payment_mode'],
                    $validated['receipt_date'],
                    $narration,
                    $request->user()->id,
                    PaymentReceipt::class,
                    $receipt->id,
                );
            }
        }

        // Update purchase invoice balance if linked
        if (! empty($validated['purchase_invoice_id'])) {
            $invoice = PurchaseInvoice::find($validated['purchase_invoice_id']);
            if ($invoice && $validated['type'] === 'payment') {
                $newAmountPaid = min(
                    (float) $invoice->amount_paid + (float) $validated['amount'],
                    (float) $invoice->grand_total
                );
                $invoice->update([
                    'amount_paid' => $newAmountPaid,
                    'balance_due' => max(0, (float) $invoice->grand_total - $newAmountPaid),
                ]);
            }
        }

        // Update sales invoice balance if linked
        if (! empty($validated['sales_invoice_id'])) {
            $invoice = SalesInvoice::find($validated['sales_invoice_id']);
            if ($invoice && $validated['type'] === 'receipt') {
                $newAmountPaid = min(
                    (float) $invoice->amount_paid + (float) $validated['amount'],
                    (float) $invoice->grand_total
                );
                $invoice->update([
                    'amount_paid' => $newAmountPaid,
                    'balance_due' => max(0, (float) $invoice->grand_total - $newAmountPaid),
                ]);
            }
        }

        return response()->json(['data' => $receipt], 201);
    }

    public function show(PaymentReceipt $paymentReceipt): JsonResponse
    {
        $this->authorize('view', $paymentReceipt);

        return response()->json(['data' => $paymentReceipt->load('party')]);
    }

    /**
     * Return the auto-posted journal voucher (with Dr/Cr lines) for a payment/receipt.
     */
    public function journal(PaymentReceipt $paymentReceipt): JsonResponse
    {
        $this->authorize('view', $paymentReceipt);

        $voucher = Voucher::with('lines.ledger')
            ->where('reference_type', PaymentReceipt::class)
            ->where('reference_id', $paymentReceipt->id)
            ->first();

        return response()->json(['data' => $voucher]);
    }

    public function destroy(PaymentReceipt $paymentReceipt): JsonResponse
    {
        $this->authorize('delete', $paymentReceipt);

        $paymentReceipt->delete();

        return response()->json(['message' => 'Payment/receipt deleted']);
    }
}
