import { useState, type FormEvent } from "react";
import { AlertIcon, ArrowRightIcon, InvoiceIcon, LockIcon, ShieldIcon } from "./Icon";

const PASSWORD = import.meta.env.VITE_APP_PASSWORD ?? "1234567890";

interface Props {
    onUnlock: () => void;
}

export default function PasswordGate({ onUnlock }: Props) {
    const [value, setValue] = useState("");
    const [error, setError] = useState(false);

    function submit(event: FormEvent) {
        event.preventDefault();
        if (value === PASSWORD) {
            onUnlock();
            return;
        }
        setError(true);
        setValue("");
    }

    return (
        <div className="gate">
            <div className="gate-inner">
                <form className="gate-card" onSubmit={submit}>
                    <div className="brand-mark">
                        <InvoiceIcon />
                    </div>
                    <h1>Fatura Başlık Düzenleyici</h1>
                    <p className="muted">Faturanın sol üstündeki firma bilgilerini saniyeler içinde değiştirin.</p>
                    <label className="input-icon">
                        <LockIcon />
                        <input
                            type="password"
                            value={value}
                            autoFocus
                            placeholder="Erişim şifresi"
                            aria-label="Erişim şifresi"
                            onChange={(event) => {
                                setValue(event.target.value);
                                setError(false);
                            }}
                        />
                    </label>
                    {error && (
                        <p className="inline-error">
                            <AlertIcon />
                            Şifre hatalı, tekrar deneyin.
                        </p>
                    )}
                    <button type="submit" className="btn btn-primary btn-lg">
                        Giriş yap
                        <ArrowRightIcon />
                    </button>
                </form>
                <p className="gate-foot">
                    <ShieldIcon />
                    Faturalar tarayıcınızdan çıkmaz, hiçbir veri saklanmaz.
                </p>
            </div>
        </div>
    );
}
