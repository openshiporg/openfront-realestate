'use client'

import { useActionState, useEffect, useId, useRef } from 'react'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { pillClass, pillPrimaryClass } from '../../components/styles'
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

export function SuspendMemberButton({ membershipId, memberName }: { membershipId: string; memberName: string }) {
  const [state, action, pending] = useActionState(suspendBrokerageMember, initial)
  const formRef = useRef<HTMLFormElement>(null)
  useResultToast(state)
  return (
    <form ref={formRef} action={action} className="shrink-0">
      <input type="hidden" name="membershipId" value={membershipId} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className={cn(pillClass, 'border-transparent text-muted-foreground hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive')} disabled={pending}>{pending ? 'Suspending…' : 'Suspend'}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-[6px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {memberName}?</AlertDialogTitle>
            <AlertDialogDescription>They will no longer be able to sign in to this brokerage.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[6px]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-[6px] bg-destructive text-white hover:bg-destructive/90" onClick={() => formRef.current?.requestSubmit()}>Suspend access</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
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
