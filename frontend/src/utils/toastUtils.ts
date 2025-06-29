import { toast, ToastOptions } from "react-toastify";

const defaultOptions: ToastOptions = {
  position: "top-right",
  autoClose: 3000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: false,
  draggable: false,
};

export const showSuccess = (message: string, options?: ToastOptions) =>
  toast.success(message, { ...defaultOptions, ...options });

export const showError = (message: string, options?: ToastOptions) =>
  toast.error(message, { ...defaultOptions, ...options });

export const showInfo = (message: string, options?: ToastOptions) =>
  toast.info(message, { ...defaultOptions, ...options });

export const showWarning = (message: string, options?: ToastOptions) =>
  toast.warning(message, { ...defaultOptions, ...options });