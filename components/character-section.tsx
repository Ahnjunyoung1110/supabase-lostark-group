'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { CharacterCard } from '@/components/character-card';
import { CharacterForm } from '@/components/character-form';
import type { CharacterRow } from '@/lib/characters';

const MAX_CHARACTERS = 3;

interface CharacterSectionProps {
  characters: CharacterRow[];
}

export function CharacterSection({ characters }: CharacterSectionProps) {
  const [showForm, setShowForm] = useState(false);

  const canAdd = characters.length < MAX_CHARACTERS;
  // 폼이 열려 있으면 폼 자체가 슬롯 하나 차지
  const emptySlots = MAX_CHARACTERS - characters.length - (showForm && canAdd ? 1 : 0);

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      {/* 등록된 캐릭터 */}
      {characters.map((char) => (
        <CharacterCard key={char.id} character={char} />
      ))}

      {/* 등록 폼 슬롯 */}
      {showForm && canAdd && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-4">캐릭터 등록</p>
            <CharacterForm
              onSuccess={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* 빈 슬롯 — 클릭 시 폼 열기 */}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <button
          key={`empty-${i}`}
          type="button"
          onClick={() => setShowForm(true)}
          disabled={showForm}
          className="rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-2 p-6 min-h-[200px] text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
        >
          <Plus className="w-6 h-6" />
          <span className="text-sm">캐릭터 추가</span>
        </button>
      ))}
    </div>
  );
}
