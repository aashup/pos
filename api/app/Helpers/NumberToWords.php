<?php

namespace App\Helpers;

class NumberToWords
{
    private static array $ones = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen',
    ];

    private static array $tens = [
        '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
    ];

    /**
     * Convert a number to Indian currency words.
     * e.g. 29929.00 → "Twenty Nine Thousand Nine Hundred Twenty Nine Rupees And Zero Paisa Only"
     */
    public static function convert(float $amount): string
    {
        $amount = round($amount, 2);
        $rupees = (int) floor(abs($amount));
        $paisa = (int) round((abs($amount) - $rupees) * 100);

        $rupeesWords = $rupees > 0 ? self::numberToWords($rupees).' Rupees' : 'Zero Rupees';
        $paisaWords = $paisa > 0 ? self::numberToWords($paisa).' Paisa' : 'Zero Paisa';

        $prefix = $amount < 0 ? 'Minus ' : '';

        return $prefix.$rupeesWords.' And '.$paisaWords.' Only';
    }

    private static function numberToWords(int $number): string
    {
        if ($number === 0) {
            return 'Zero';
        }

        if ($number < 0) {
            return 'Minus '.self::numberToWords(abs($number));
        }

        $words = '';

        // Crore (1,00,00,000)
        if ($number >= 10000000) {
            $words .= self::numberToWords((int) floor($number / 10000000)).' Crore ';
            $number %= 10000000;
        }

        // Lakh (1,00,000)
        if ($number >= 100000) {
            $words .= self::numberToWords((int) floor($number / 100000)).' Lakh ';
            $number %= 100000;
        }

        // Thousand (1,000)
        if ($number >= 1000) {
            $words .= self::numberToWords((int) floor($number / 1000)).' Thousand ';
            $number %= 1000;
        }

        // Hundred (100)
        if ($number >= 100) {
            $words .= self::$ones[(int) floor($number / 100)].' Hundred ';
            $number %= 100;
        }

        if ($number > 0) {
            if ($number < 20) {
                $words .= self::$ones[$number];
            } else {
                $words .= self::$tens[(int) floor($number / 10)];
                if ($number % 10 > 0) {
                    $words .= ' '.self::$ones[$number % 10];
                }
            }
        }

        return trim($words);
    }
}
