import * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const {
    position = "top-center",
    offset = { top: 76, left: 16, right: 16 },
    mobileOffset = { top: 72, left: 12, right: 12 },
    ...toasterProps
  } = props;

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={position}
      offset={offset}
      mobileOffset={mobileOffset}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...toasterProps}
    />
  );
};

export { Toaster, toast };
