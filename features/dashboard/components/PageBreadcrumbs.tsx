import React from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AssistantHeaderButton } from "./AssistantHeaderButton";
import { basePath } from "../lib/config";

interface BreadcrumbItem {
  type: "link" | "model" | "page";
  label: string;
  href?: string;
}

interface PageBreadcrumbsProps {
  items: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageBreadcrumbs({ items, actions }: PageBreadcrumbsProps) {
  return (
    <header className="sticky top-0 z-30 bg-background flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b">
      <div className="flex min-w-0 items-center gap-2 px-4 w-full justify-between">
        <div className="flex min-w-0 items-center gap-3 md:shrink-0">
          <SidebarTrigger className="-ml-1 max-md:size-11" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {/* Phones have no room for the trail, so the bar names the page instead. */}
          {items.length ? <span className="truncate text-sm font-medium text-foreground md:hidden">{items[items.length - 1].label}</span> : null}
          <Breadcrumb className="hidden md:flex">
            <BreadcrumbList>
              {items.map((item, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {item.type === "link" && (
                      <BreadcrumbLink asChild>
                        <Link className="text-foreground" href={`${basePath}${item.href || "#"}`}>{item.label}</Link>
                      </BreadcrumbLink>
                    )}
                    {item.type === "model" && (
                      <BreadcrumbLink asChild>
                        <Link className="text-foreground" href={`${basePath}${item.href || "#"}`}>{item.label}</Link>
                      </BreadcrumbLink>
                    )}
                    {item.type === "page" && (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        {/* Actions shrink (labels truncate) so long list names never push the header past a 320px screen. */}
        <div className="flex min-w-0 items-center justify-end gap-3 [&>*]:min-w-0">
          {actions}
          <AssistantHeaderButton className="shrink-0" />
        </div>
      </div>
    </header>
  );
}