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
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
              {items.map((item, index) => (
                <React.Fragment key={index}>
                  {/* Phones keep the last two crumbs so the trail stays on one line beside the header buttons. */}
                  {index > 0 && <BreadcrumbSeparator className={index < items.length - 1 ? "max-md:hidden" : undefined} />}
                  <BreadcrumbItem className={index < items.length - 2 ? "max-md:hidden" : "min-w-0"}>
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
                      <BreadcrumbPage className="block leading-tight max-md:line-clamp-none md:truncate">{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          <AssistantHeaderButton />
        </div>
      </div>
    </header>
  );
}