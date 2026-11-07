import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import { cn } from '@/lib/utils';

function RadioGroup<Value>({ className, ...props }: RadioGroupPrimitive.Props<Value>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn('flex w-fit items-center gap-0.5 rounded-lg bg-muted p-0.5', className)}
      {...props}
    />
  );
}

/** Segmented radio item: role="radio" with aria-checked, arrow keys rove focus inside the group. */
function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        'inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export { RadioGroup, RadioGroupItem };
