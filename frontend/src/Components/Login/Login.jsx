import "./Login.scss"
import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { authenticate, isAuthenticated } from "../../API/auth";
import backend from "../../backend"

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const emailRef = useRef(null);
    const passwordRef = useRef(null);
    const [error, setError] = useState("");
    let navigate = useNavigate();

    const emailHandler = (e) => {
        setEmail(e.target.value);
    }

    const passwordHandler = (e) => {
        setPassword(e.target.value);
    }

    const submitHandler = (e) => {
        setLoading(true);
        e.preventDefault();
        axios.post(`${backend}/signin`,{email,password})
            .then((res => {
                console.log(res.data.user);
                setError("")
                authenticate(res.data.user,res.data.token, () => {
                    setEmail("");
                    setPassword("");
                });
                window.location.reload(true);
                navigate('/');
                setLoading(false);
            }))
            .catch((error) => {
                console.log(error.response.data.error);
                setError(error.response.data.error)
                setLoading(false);
            })
    }
    const LoadingComponent = () => {
        return (
            <div id="loading-wrapper">
                <div id="loading-text">LOADING</div>
                <div id="loading-content"></div>
            </div>
        )
    }

    useEffect(() => {
        if (isAuthenticated()) {
             navigate('/');
        }
    }, []);

    return (
        <section id="login-form-section">
            {loading ? <LoadingComponent /> : <form>
                <h2>Login!</h2>
                <fieldset>
                    <legend>Login</legend>
                    <ul>
                        <li>
                            <label>Email:</label>
                            <input ref={emailRef} type="text" id="Email" required onChange={emailHandler} />
                        </li>
                        <li>
                            <label>Password:</label>
                            <input ref={passwordRef} type="password" id="password" required onChange={passwordHandler} />
                        </li>
                    </ul>
                </fieldset>
                {error && <p id="error-msg">{error}</p>}
                <button type='submit' style={{ cursor: "pointer" }} onClick={submitHandler}>Login</button>
                <Link to="/signup"><button style={{ cursor: "pointer" }} type="button">Don't have an Account?</button></Link>
            </form>
            }
        </section>
    )
}

export default Login