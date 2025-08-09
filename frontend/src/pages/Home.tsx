import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [showContactForm, setShowContactForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", message: "", honeypot: "" });
  const [formError, setFormError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const offset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const handlePlayClick = () => navigate("/enter-room");
  const handleAccountClick = () => navigate("/account");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, message, honeypot } = formData;

    // Honeypot check
    if (honeypot) {
      console.warn("Bot detected — submission ignored.");
      return;
    }

    if (!name || !email || !message) {
      setFormError("Please fill out all fields.");
      return;
    }

    setFormError("");
    try {
      await fetch("https://formspree.io/f/your-form-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      alert("Message sent! We'll get back to you soon.");
      setShowContactForm(false);
      setFormData({ name: "", email: "", message: "", honeypot: "" });
    } catch (err) {
      alert("Failed to send message. Try again later.");
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !modalRef.current) return;
      modalRef.current.style.left = `${e.clientX - offset.current.x}px`;
      modalRef.current.style.top = `${e.clientY - offset.current.y}px`;
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    window.addEventListener("load", () => {
      document.body.classList.add("loaded");
    });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    if (!modalRef.current) return;
    isDragging.current = true;
    const rect = modalRef.current.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>
        Let’s Party All<br />Night! 🎉
      </h1>

      <div style={styles.imageRow}>
        <div
          style={styles.imageButton}
          onClick={(e) => {
            e.preventDefault();
            handlePlayClick();
          }}
        >
          <img src="/images/rank-the-topic.jpg" alt="Rank the Topic" style={styles.image} />
          <p style={styles.imageLabel}>Play Now</p>
        </div>

        <div style={styles.imageButton}>
          <div style={styles.imageWrapper}>
            <img src="/images/golden-cow.jpg" alt="Golden Cow Game" style={styles.image} />
            {!showContactForm && (
              <div style={styles.overlay}>Coming Soon!</div>
            )}
          </div>
        </div>
      </div>

      <div style={styles.buttonRow}>
        <button onClick={handleAccountClick} style={styles.button}>Account</button>
        <button onClick={() => setShowContactForm(true)} style={styles.button}>Contact Us</button>
      </div>

      {showContactForm && (
        <div style={styles.modal}>
          <div ref={modalRef} style={styles.formContainer} onMouseDown={startDrag}>
            <button onClick={() => setShowContactForm(false)} style={styles.closeButton}>✖</button>
            <h2>Contact Us</h2>
            <p>Send a message to: <strong>example@letspartyallnight.games</strong></p>
            <form onSubmit={handleSubmit}>
              <input name="name" placeholder="Your name" value={formData.name} onChange={handleInputChange} style={styles.input} />
              <input name="email" placeholder="Your email" value={formData.email} onChange={handleInputChange} style={styles.input} />
              <textarea name="message" placeholder="Your message" value={formData.message} onChange={handleInputChange} style={styles.textarea} />
              <input
                name="honeypot"
                value={formData.honeypot}
                onChange={handleInputChange}
                style={{ display: "none" }}
                autoComplete="off"
              />
              {formError && <p style={{ color: "red" }}>{formError}</p>}
              <button type="submit" style={styles.submitButton}>Send</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const neonPulse = "0 0 10px #ff00ff, 0 0 20px #ff00ff, 0 0 30px #ff00ff";

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: "#0d0d0d",
    color: "#fff",
    minHeight: "100vh",
    padding: "2rem",
    textAlign: "center",
    fontFamily: "sans-serif",
  },
  title: {
    fontFamily: "Picadilly, sans-serif",
    fontSize: "7rem",
    color: "#ff00ff",
    textAlign: "center",
    lineHeight: "1.2",
    textShadow: `
      0 0 20px #ff00ff,
      0 0 40px #ff00ff,
      0 0 80px #ff00ff,
      0 0 120px #ff00ff
    `,
    animation: "glowTitle 2s infinite alternate",
    marginBottom: "2rem",
  },
  imageRow: {
    display: "flex",
    justifyContent: "center",
    gap: "2rem",
    marginBottom: "2rem",
    flexWrap: "wrap",
  },
  imageButton: {
    cursor: "pointer",
    textAlign: "center",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  },
  image: {
    width: "200px",
    height: "200px",
    objectFit: "cover",
    borderRadius: "8px",
    boxShadow: neonPulse,
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  },
  imageLabel: {
    marginTop: "0.5rem",
    color: "#ffff00",
    fontWeight: "bold",
    fontFamily: "Vivaldi, cursive",
  },
  imageWrapper: {
    position: "relative",
    display: "inline-block",
  },
  overlay: {
    whiteSpace: "nowrap",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) rotate(-20deg)",
    color: "#00ff00",
    fontWeight: "bold",
    fontSize: "3rem",
    textShadow: "0 0 10px #00ff00, 0 0 25px #00ff00, 0 0 50px #00ff00",
    fontFamily: "Beauty School Dropout, sans-serif",
    zIndex: 2,
    pointerEvents: "none",
    backgroundColor: "transparent",
    opacity: 0.9,
    animation: "flicker 2s infinite",
  },
  buttonRow: {
    display: "flex",
    justifyContent: "center",
    gap: "1rem",
    marginBottom: "2rem",
    flexWrap: "wrap",
  },
  button: {
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    cursor: "pointer",
    backgroundColor: "#222",
    color: "#00ff00",
    border: "2px solid #00ff00",
    borderRadius: "6px",
    boxShadow: "0 0 10px #00ff00",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  },
  modal: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  formContainer: {
    backgroundColor: "#1a1a1a",
    padding: "2rem",
    borderRadius: "8px",
    boxShadow: neonPulse,
    position: "absolute",
    cursor: "move",
    width: "90%",
    maxWidth: "500px",
    color: "#fff",
    fontFamily: "sans-serif",
  },
  closeButton: {
    position: "absolute",
    top: "0.5rem",
    right: "0.5rem",
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: "1.5rem",
    cursor: "pointer",
  },
  input: {
    width: "100%",
    padding: "0.5rem",
    marginBottom: "1rem",
    borderRadius: "4px",
    border: "1px solid #ccc",
    fontFamily: "sans-serif",
  },
  textarea: {
    width: "100%",
    padding: "0.5rem",
    height: "100px",
    marginBottom: "1rem",
    borderRadius: "4px",
    border: "1px solid #ccc",
    fontFamily: "sans-serif",
  },
  submitButton: {
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    backgroundColor: "#ff00ff",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    boxShadow: neonPulse,
    fontFamily: "Picadilly, sans-serif",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  },
};

export default Home;
