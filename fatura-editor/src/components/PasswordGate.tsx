import { useState, type FormEvent } from "react";

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
            <form className="gate-card" onSubmit={submit}>
                <h1>Fatura Başlık Düzenleyici</h1>
                <p className="muted">Devam etmek için şifreyi girin.</p>
                <input
                    type="password"
                    value={value}
                    autoFocus
                    placeholder="Şifre"
                    onChange={(event) => {
                        setValue(event.target.value);
                        setError(false);
                    }}
                />
                {error && <p className="error">Şifre hatalı.</p>}
                <button type="submit" className="primary">
                    Giriş
                </button>
            </form>
        </div>
    );
}
