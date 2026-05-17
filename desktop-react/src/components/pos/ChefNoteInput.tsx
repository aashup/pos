import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useCartStore } from '@/src/store/cartStore';

interface Props {
  lineId: string;
  note: string | null;
  sent: boolean;
}

export function ChefNoteInput({ lineId, note, sent }: Props) {
  const [expanded, setExpanded] = useState(false);
  const setNote = useCartStore((s) => s.setNote);

  if (sent && note) {
    return (
      <Text className="text-amber-600 text-xs italic mt-0.5" numberOfLines={2}>
        📝 {note}
      </Text>
    );
  }

  if (sent) return null;

  return (
    <View className="mt-1">
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} className="flex-row items-center">
        <Text className="text-gray-400 text-xs">💬 {note ? note : 'Add note'}</Text>
      </TouchableOpacity>
      {expanded && (
        <TextInput
          className="mt-1 border border-amber-300 rounded bg-amber-50 px-2 py-1 text-xs text-gray-700"
          placeholder="e.g. no onion, extra spicy"
          value={note ?? ''}
          onChangeText={(val) => setNote(lineId, val)}
          multiline
          numberOfLines={2}
          autoFocus
        />
      )}
    </View>
  );
}
