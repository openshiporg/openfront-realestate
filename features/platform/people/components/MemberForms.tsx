'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal, UserPlus } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { pillClass, pillDangerClass, pillPrimaryClass, quietButtonClass } from '../../components/styles'
import { FormDrawer } from '../../components/RecordForm'
import { inviteBrokerageMember, suspendBrokerageMember, type PeopleCommandState } from '../actions/people'

const initial: PeopleCommandState = { ok: false, message: '' }

function useResultToast(state: PeopleCommandState, onSuccess?: () => void) {
  useEffect(() => {
    if (!state.message) return
    if (state.ok) { toast.success(state.message); onSuccess?.() }
    else toast.error(state.message)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
}

export function InviteMemberForm({ brokerageId, onDone }: { brokerageId: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState(inviteBrokerageMember, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()
  useResultToast(state, () => { formRef.current?.reset(); onDone?.() })
  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="brokerageId" value={brokerageId} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`}>Full name</Label>
          <Input className="h-9 rounded-[6px]" id={`${id}-name`} name="name" required maxLength={120} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-email`}>Email</Label>
          <Input className="h-9 rounded-[6px]" id={`${id}-email`} name="email" type="email" required autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-password`}>Temporary password</Label>
          <Input className="h-9 rounded-[6px]" id={`${id}-password`} name="temporaryPassword" type="password" required minLength={12} autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-role`}>Role</Label>
          <Select name="roleName" defaultValue="Listing Agent">
            <SelectTrigger id={`${id}-role`} className="h-9 w-full rounded-[6px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-[6px]">
              <SelectItem value="Listing Agent">Listing Agent</SelectItem>
              <SelectItem value="Brokerage Analyst">Brokerage Analyst</SelectItem>
              <SelectItem value="Brokerage Admin">Brokerage Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-membership`}>Position</Label>
          <Select name="membershipRole" defaultValue="agent">
            <SelectTrigger id={`${id}-membership`} className="h-9 w-full rounded-[6px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-[6px]">
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="team_lead">Team lead</SelectItem>
              <SelectItem value="coordinator">Coordinator</SelectItem>
              <SelectItem value="analyst">Analyst</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" variant="ghost" size="sm" className={cn(pillPrimaryClass, 'mt-4')} disabled={pending}>{pending ? 'Adding…' : 'Add member'}</Button>
    </form>
  )
}

/**
 * Row actions for a member: a neutral "View" as the visible primary, and Suspend behind
 * the More menu with a confirmation, so a destructive command is never the row's only action.
 */
export function MemberRowActions({ membershipId, memberName, viewHref, canSuspend, className }: { membershipId?: string | null; memberName: string; viewHref: string; canSuspend: boolean; className?: string }) {
  const [state, action, pending] = useActionState(suspendBrokerageMember, initial)
  const [confirming, setConfirming] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  useResultToast(state)
  return (
    <div className={cn('flex items-center justify-end gap-1.5', className)}>
      <Button asChild variant="ghost" size="sm" className={cn(pillClass, 'max-sm:h-9')}><Link href={viewHref}>View</Link></Button>
      {canSuspend && membershipId ? (
        <>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={`More actions for ${memberName}`} disabled={pending} className={cn(quietButtonClass, 'size-8 px-0 data-[state=open]:bg-muted max-sm:size-9')}>
                <MoreHorizontal aria-hidden className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44 rounded-[6px]">
              <DropdownMenuItem variant="destructive" className="rounded-[4px]" disabled={pending} onSelect={() => setConfirming(true)}>{pending ? 'Suspending…' : 'Suspend access…'}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <form ref={formRef} action={action} className="hidden">
            <input type="hidden" name="membershipId" value={membershipId} />
          </form>
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogContent className="rounded-[6px]">
              <AlertDialogHeader>
                <AlertDialogTitle>Suspend {memberName}?</AlertDialogTitle>
                <AlertDialogDescription>They will no longer be able to sign in to this brokerage.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className={pillClass}>Cancel</AlertDialogCancel>
                <AlertDialogAction className={pillDangerClass} onClick={() => formRef.current?.requestSubmit()}>Suspend access</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  )
}

/** Header action: the invite form opens in a side drawer. */
export function AddMemberDrawer({ brokerageId }: { brokerageId: string }) {
  return (
    <FormDrawer trigger={<><UserPlus aria-hidden className="size-4" /> Add member</>} title="Add member" primary>
      {close => <InviteMemberForm brokerageId={brokerageId} onDone={close} />}
    </FormDrawer>
  )
}
