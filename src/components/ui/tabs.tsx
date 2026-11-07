import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
 React.ElementRef<typeof TabsPrimitive.List>,
 React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
 <div className="tds-tabs">
 <div className="tds-tabs__row">
 <TabsPrimitive.List
 ref={ref}
 className={cn(
 "tds-tabs__list",
 className
 )}
 {...props}
 />
 </div>
 <div className="tds-tabs__divider" />
 </div>
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
 React.ElementRef<typeof TabsPrimitive.Trigger>,
 React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
 <TabsPrimitive.Trigger
 ref={ref}
 className={cn(
 "tds-tab-item",
 className
 )}
 {...props}
 >
 <span className="tds-tab-item__content">{children}</span>
 <span className="tds-tab-item__indicator" />
 </TabsPrimitive.Trigger>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
 React.ElementRef<typeof TabsPrimitive.Content>,
 React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
 <TabsPrimitive.Content
 ref={ref}
 className={cn(
 "",
 className
 )}
 {...props}
 />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
