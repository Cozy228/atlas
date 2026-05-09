import { useNavigate } from "@tanstack/react-router";
import {
  IconCompass,
  IconDatabase,
  IconHome,
  IconLayoutGrid,
  IconMessage2,
} from "@tabler/icons-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function IntentSearchPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  function go(to: string) {
    onOpenChange(false);
    void navigate({ to });
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Atlas command palette"
      description="Jump to a section or ask Atlas a question."
    >
      <CommandInput placeholder="Search capabilities, sources, landing zones…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}>
            <IconHome aria-hidden /> Home
          </CommandItem>
          <CommandItem onSelect={() => go("/explore")}>
            <IconCompass aria-hidden /> Explore availability
          </CommandItem>
          <CommandItem onSelect={() => go("/capabilities")}>
            <IconLayoutGrid aria-hidden /> Capabilities
          </CommandItem>
          <CommandItem onSelect={() => go("/sources")}>
            <IconDatabase aria-hidden /> Sources
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Atlas">
          <CommandItem onSelect={() => onOpenChange(false)}>
            <IconMessage2 aria-hidden /> Ask Atlas (deferred)
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
