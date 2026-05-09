<?php

namespace App\Services;

class InvoiceTemplateRegistry
{
    private static array $templates = [
        [
            'slug' => 'pharma-distributor',
            'name' => 'Pharma Distributor',
            'description' => 'Detailed invoice with batch, expiry, HSN, and per-line GST breakdown. Ideal for pharma and medical distributors.',
            'view' => 'invoices.templates.pharma-distributor',
        ],
        [
            'slug' => 'aidway-biotech',
            'name' => 'Aidway Biotech Style',
            'description' => 'GST invoice with MRP column, GST class-wise summary, bank details, and Marg ERP-style layout. Ideal for pharma wholesalers and distributors.',
            'view' => 'invoices.templates.aidway-biotech',
        ],
        [
            'slug' => 'thermal',
            'name' => 'Thermal Printer',
            'description' => 'Compact thermal receipt format for 58mm and 80mm thermal printers.',
            'view' => 'invoices.templates.thermal',
        ],
    ];

    /**
     * Get all registered templates (metadata only, no view path).
     */
    public static function getAll(): array
    {
        return array_map(fn ($t) => [
            'slug' => $t['slug'],
            'name' => $t['name'],
            'description' => $t['description'],
        ], self::$templates);
    }

    /**
     * Get the Blade view name for a template slug.
     */
    public static function getViewName(string $slug): string
    {
        foreach (self::$templates as $template) {
            if ($template['slug'] === $slug) {
                return $template['view'];
            }
        }

        // Fallback to first template
        return self::$templates[0]['view'];
    }

    /**
     * Check if a template slug exists.
     */
    public static function exists(string $slug): bool
    {
        foreach (self::$templates as $template) {
            if ($template['slug'] === $slug) {
                return true;
            }
        }

        return false;
    }
}
