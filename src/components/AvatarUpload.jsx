import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { clearOptionsCache } from '../lib/api'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import UserAvatar from './UserAvatar'
import { toast } from './Toaster'
import { confirmDialog } from './Dialogs'
import ImageCropDialog from './ImageCropDialog'

const MAX_BYTES = 4 * 1024 * 1024

/* Profile picture for a user: upload, replace, or fall back to coloured
   initials. Kept in the same public `attachments` bucket as everything else. */
export default function AvatarUpload({ user, onChange }) {
  const fileRef = useRef()
  const [busy, setBusy] = useState(false)
  const [src, setSrc] = useState(null)   // object URL of the image being cropped

  useEffect(() => () => { if (src) URL.revokeObjectURL(src) }, [src])

  /* Picking a file does not upload it: it opens the crop dialog first, so the
     user decides which square becomes the avatar. Object URLs are revoked on
     unmount to avoid leaking the preview blob. */
  const pick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('יש לבחור קובץ תמונה', 'err'); return }
    if (file.size > MAX_BYTES) { toast('התמונה גדולה מדי (מקסימום 4MB)', 'err'); return }
    setSrc(URL.createObjectURL(file))
    if (fileRef.current) fileRef.current.value = ''
  }

  const closeCrop = () => {
    if (src) URL.revokeObjectURL(src)
    setSrc(null)
  }

  const saveCropped = async (blob) => {
    setBusy(true)
    try {
      // Always .jpg: the cropper re-encodes to a fixed-size JPEG regardless of
      // what was uploaded, so the extension must match the actual content.
      const path = `avatars/${user.id}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('attachments')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw new Error(upErr.message)
      const url = supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', user.id)
      if (error) throw new Error(error.message)
      clearOptionsCache()
      onChange?.(url)
      toast('תמונת הפרופיל עודכנה')
      closeCrop()
    } catch (err) {
      toast(`העלאת התמונה נכשלה: ${err.message || ''}`, 'err')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!await confirmDialog('להסיר את תמונת הפרופיל? יוצגו ראשי התיבות במקומה.', { danger: true, confirmText: 'הסרה' })) return
    setBusy(true)
    const { error } = await supabase.from('users').update({ avatar_url: null }).eq('id', user.id)
    setBusy(false)
    if (error) return toast('ההסרה נכשלה', 'err')
    clearOptionsCache()
    onChange?.(null)
    toast('התמונה הוסרה')
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <UserAvatar user={user} size="lg" className="size-16 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">תמונת פרופיל</p>
          <p className="text-muted-foreground text-xs">
            {user?.avatar_url ? 'מוצגת בכל מקום שבו המשתמש מקושר.' : 'ללא תמונה מוצגות ראשי התיבות בצבע קבוע.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Camera className="size-4" /> {user?.avatar_url ? 'החלפת תמונה' : 'העלאת תמונה'}
            </Button>
            {user?.avatar_url && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>
                <Trash2 className="size-4" /> הסרה
              </Button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        </div>
      </CardContent>
      {src && (
        <ImageCropDialog open src={src} busy={busy} onClose={closeCrop} onCropped={saveCropped} />
      )}
    </Card>
  )
}
