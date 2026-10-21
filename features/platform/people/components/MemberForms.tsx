'use client'

import { useActionState, useEffect, useId, useRef } from 'react'
import { toast } from 'sonner'
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

export function InviteMemberForm({ brokerageId }: { brokerageId: string }) {
  const [state, action, pending] = useActionState(inviteBrokerageMember, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()
  useResultToast(state, () => formRef.current?.reset())
  return (
    <form ref={formRef} action={action} className="rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="brokerageId" value={brokerageId} />
      <h2 className="text-base font-semibold text-foreground">Add member</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`}>Full name</Label>
          <Input id={`${id}-name`} name="name" required maxLength={120} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-email`}>Email</Label>
          <Input id={`${id}-email`} name="email" type="email" required autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-password`}>Temporary password</Label>
          <Input id={`${id}-password`} name="temporaryPassword" type="password" required minLength={12} autoComplete="new-password" placeholder="At least 12 characters" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-role`}>Role</Label>
          <Select name="roleName" defaultValue="Listing Agent">
            <SelectTrigger id={`${id}-role`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Listing Agent">Listing Agent</SelectItem>
              <SelectItem value="Brokerage Analyst">Brokerage Analyst</SelectItem>
              <SelectItem value="Brokerage Admin">Brokerage Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-membership`}>Position</Label>
          <Select name="membershipRole" defaultValue="agent">
            <SelectTrigger id={`${id}-membership`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="team_lead">Team lead</SelectItem>
              <SelectItem value="coordinator">Coordinator</SelectItem>
              <SelectItem value="analyst">Analyst</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" size="sm" className="mt-4" disabled={pending}>{pending ? 'Adding…' : 'Add member'}</Button>
    </form>
  )
}

export function SuspendMemberButton({ membershipId, memberName }: { membershipId: string; memberName: string }) {
  const [state, action, pending] = useActionState(suspendBrokerageMember, initial)
  const formRef = useRef<HTMLFormElement>(null)
  useResultToast(state)
  return (
    <form ref={formRef} action={action} className="mt-3">
      <input type="hidden" name="membershipId" value={membershipId} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={pending}>{pending ? 'Suspending…' : 'Suspend access'}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {memberName}?</AlertDialogTitle>
            <AlertDialogDescription>They will no longer be able to sign in to this brokerage.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => formRef.current?.requestSubmit()}>Suspend access</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
