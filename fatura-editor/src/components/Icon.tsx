import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

/** Arayüzdeki tüm ikonlar: 24'lük ızgara, currentColor, 1.6 kalınlık. */
function Base({ children, ...props }: Props) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            {children}
        </svg>
    );
}

export function InvoiceIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M6 3.5h9.5L19 7v13.5H6z" />
            <path d="M15 3.5V7h4" />
            <path d="M8.75 11h4.5M8.75 14.5h6.5" />
        </Base>
    );
}

export function LockIcon(props: Props) {
    return (
        <Base {...props}>
            <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </Base>
    );
}

export function UploadIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M12 15.5V4.5" />
            <path d="M8 8.5 12 4.5l4 4" />
            <path d="M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
        </Base>
    );
}

export function DownloadIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M12 4.5v11" />
            <path d="M8 11.5l4 4 4-4" />
            <path d="M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
        </Base>
    );
}

export function ImageIcon(props: Props) {
    return (
        <Base {...props}>
            <rect x="4" y="5" width="16" height="14" rx="2.5" />
            <circle cx="9" cy="10" r="1.5" />
            <path d="m5 17 4.5-4.5 3 3L15.5 12 19 15.5" />
        </Base>
    );
}

export function ResetIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M4.5 9.5A8 8 0 1 1 4 13.5" />
            <path d="M4.5 4.5v5h5" />
        </Base>
    );
}

export function DropperIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="m14.5 5.5 4 4" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3l-1.5 1.5-3-3z" />
            <path d="M14.5 8 6.8 15.7a2 2 0 0 0-.55 1.02L5.5 20l3.28-.75a2 2 0 0 0 1.02-.55L17.5 11z" />
        </Base>
    );
}

export function LayersIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="m12 3.5 8 4.25-8 4.25-8-4.25z" />
            <path d="m4 12.5 8 4.25 8-4.25" />
        </Base>
    );
}

export function TypeIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M5 6.5V5h14v1.5" />
            <path d="M12 5v14" />
            <path d="M9 19h6" />
        </Base>
    );
}

export function CropIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M6.5 3.5v12a1.5 1.5 0 0 0 1.5 1.5h12" />
            <path d="M3.5 6.5h12A1.5 1.5 0 0 1 17 8v12" />
        </Base>
    );
}

export function TrashIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M4.5 7h15" />
            <path d="M9.5 7V4.5h5V7" />
            <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
        </Base>
    );
}

export function RuleIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M4 6.5h16M4 17.5h16" />
            <path d="M7.5 11h9" strokeDasharray="2 2" />
        </Base>
    );
}

export function MoveIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M12 4.5v15M4.5 12h15" />
            <path d="m9 7.5 3-3 3 3M9 16.5l3 3 3-3M7.5 9l-3 3 3 3M16.5 9l3 3-3 3" />
        </Base>
    );
}

export function PagesIcon(props: Props) {
    return (
        <Base {...props}>
            <rect x="8" y="3.5" width="11.5" height="14" rx="2" />
            <path d="M15.5 20.5H6.5a2 2 0 0 1-2-2V7" />
        </Base>
    );
}

export function ChevronLeftIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="m14 6-6 6 6 6" />
        </Base>
    );
}

export function ChevronRightIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="m10 6 6 6-6 6" />
        </Base>
    );
}

export function AlertIcon(props: Props) {
    return (
        <Base {...props}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 8v4.5" />
            <path d="M12 16h.01" />
        </Base>
    );
}

export function ShieldIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M12 3.5l6.5 2.5v5.5c0 4-2.7 7-6.5 8.5-3.8-1.5-6.5-4.5-6.5-8.5V6z" />
            <path d="m9.5 12 1.8 1.8 3.4-3.6" />
        </Base>
    );
}

export function ArrowRightIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M5 12h13" />
            <path d="m13 7 5 5-5 5" />
        </Base>
    );
}

export function SparkIcon(props: Props) {
    return (
        <Base {...props}>
            <path d="M12 4.5l1.6 4.4 4.4 1.6-4.4 1.6L12 16.5l-1.6-4.4L6 10.5l4.4-1.6z" />
            <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
        </Base>
    );
}
