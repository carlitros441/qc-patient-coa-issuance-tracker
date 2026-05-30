import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer: ReactNode;
}

export function Modal({ title, children, onClose, footer }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">x</button>
        </header>
        <div className="modal-body">{children}</div>
        <footer>{footer}</footer>
      </section>
    </div>
  );
}
