import type React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

type PermissionButtonProps = React.ComponentProps<typeof Button> & {
  permission?: string;
  disabledReason?: string;
};

export function PermissionButton({
  permission,
  disabledReason = 'Sem permissão',
  disabled,
  children,
  ...props
}: PermissionButtonProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const allowed = permission ? hasPermission(permission) : true;
  const isDisabled = disabled || !allowed;

  if (!isDisabled) {
    return (
      <Button {...props} disabled={disabled}>
        {children}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button {...props} disabled title={disabledReason}>
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  );
}
