import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

type ConfirmOptions = {
  title: string;
  text: string;
  confirmText?: string;
  cancelText?: string;
  icon?: 'warning' | 'question' | 'info' | 'error';
};

export async function confirmAction({
  title,
  text,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  icon = 'warning',
}: ConfirmOptions): Promise<boolean> {
  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true,
    heightAuto: false,
    background: '#18181b',
    color: '#f4f4f5',
    customClass: {
      popup: 'rounded-2xl border border-white/10',
      confirmButton: 'rounded-lg px-4 py-2',
      cancelButton: 'rounded-lg px-4 py-2',
    },
  });
  return result.isConfirmed;
}

export async function notifySuccess(title: string, text?: string) {
  await Swal.fire({
    title,
    text,
    icon: 'success',
    timer: 1800,
    showConfirmButton: false,
    heightAuto: false,
    background: '#18181b',
    color: '#f4f4f5',
  });
}

export async function notifyError(title: string, text?: string) {
  await Swal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonText: 'Entendido',
    heightAuto: false,
    background: '#18181b',
    color: '#f4f4f5',
  });
}
