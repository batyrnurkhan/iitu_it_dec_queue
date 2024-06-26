import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/homePage.css';
import {config} from "../config";
//import logo from '../logos/logo2.png';

function QueuesPage() {
    const [queues, setQueues] = useState([]);
    console.log(queues);

    const fetchQueues = () => {
        axios.get(config.fetchQueuesUrl, {
            headers: {
                'Authorization': `Token ${localStorage.getItem('access_token')}`
            }
        })
        .then(response => setQueues(response.data))
        .catch(error => console.error("Error fetching queues:", error));
    };

    useEffect(() => {
        fetchQueues();
    }, []);



    return (
        <div className="main">
            <div className="in_process">
                <h1 className="text_in">В процессе</h1>
                {queues.map(queue => (
                    queue["Сейчас обслуживается талон"] ? (
                        <div key={queue.Очередь} className="green_box">
                            <p className="list_text_style">{queue["Сейчас обслуживается талон"]} к {queue["Очередь"]} менеджеру</p>
                        </div>
                    ) : null
                ))}
            </div>
            <div className="in_queue">
                <div className="line1"></div>
                <div className="line2"></div>
                <h1 className="text_in">Ожидающие</h1>
                <div className="right">
                    {queues.map(queue => (
                        Array.isArray(queue["Зарегестрированные талоны"]) && queue["Зарегестрированные талоны"].map(ticket => (
                            <div className="gray_box_l" key={ticket}>
                                <p className="list_text_style">{ticket}</p>
                            </div>
                        ))
                    ))}
                </div>
            </div>

            <div className="qr">
                <img src={config.generateQrUrl} alt="QR Code for joining queue" />
            </div>
        </div>
    );
}
export default QueuesPage;