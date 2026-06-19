'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { addCharacter } from '@/app/characters/actions';

interface CharacterFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CharacterForm({ onSuccess, onCancel }: CharacterFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    const name = formData.get('character_name') as string;
    const server = formData.get('server_name') as string;

    setError(null);
    setIsLoading(true);

    const result = await addCharacter(name, server || undefined);

    if (result.error) {
      setError(result.error);
    } else {
      formRef.current?.reset();
      onSuccess?.();
    }
    setIsLoading(false);
  };

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="character_name">
          캐릭터명 <span className="text-red-500">*</span>
        </Label>
        <Input
          id="character_name"
          name="character_name"
          placeholder="캐릭터명을 입력하세요"
          required
          disabled={isLoading}
          autoFocus
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="server_name">
          서버명{' '}
          <span className="text-xs text-muted-foreground">(선택)</span>
        </Label>
        <Input
          id="server_name"
          name="server_name"
          placeholder="예: 카제로스"
          disabled={isLoading}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isLoading} className="flex-1 min-h-10 gap-1.5">
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              스펙 조회 중...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              등록
            </>
          )}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
            className="min-h-10"
          >
            취소
          </Button>
        )}
      </div>
    </form>
  );
}
