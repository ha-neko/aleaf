// Ideology Test JavaScript - Optimized
class IdeologyTest {
    constructor() {
        this.currentTest = null;
        this.currentQuestion = 0;
        this.answers = [];
        this.scores = {};
        
        // Cache DOM elements
        this.elements = {
            home: document.querySelector('.home'),
            test: document.querySelector('.test'),
            control: document.querySelector('.control'),
            loading: document.querySelector('.loading'),
            result: document.querySelector('.result'),
            question: document.querySelector('.questions'),
            options: [
                document.querySelector('.option1'),
                document.querySelector('.option2'),
                document.querySelector('.option3'),
                document.querySelector('.option4')
            ],
            nextBtn: document.querySelector('.next'),
            prevBtn: document.querySelector('.previous'),
            submitBtn: document.querySelector('.submit'),
            currentQ: document.querySelector('.current-question'),
            totalQ: document.querySelector('.total-questions'),
            progressFill: document.querySelector('.progress-fill'),
            resultTitle: document.querySelector('.result-title'),
            resultDesc: document.querySelector('.result-description')
        };
        
        this.initializeData();
        this.bindEvents();
        this.showHome();
    }
    
    initializeData() {
        this.tests = {
            political: {
                name: "Political Ideology",
                ideologies: [
                    'Communism', 'Socialism', 'Liberalism', 'Conservatism', 'Libertarianism',
                    'Fascism', 'Anarchism', 'Social Democracy', 'Neoliberalism', 'Populism'
                ],
                questions: [
                    {
                        q: "What role should the government play in the economy?",
                        options: ["Complete control", "Significant regulation", "Minimal regulation", "No intervention"],
                        weights: { Communism: [4,2,0,0], Socialism: [3,4,1,0], Liberalism: [1,3,3,1], Conservatism: [0,2,4,2], Libertarianism: [0,0,2,4], Fascism: [4,3,1,0], Anarchism: [0,0,1,4], 'Social Democracy': [2,4,2,0], Neoliberalism: [0,1,4,3], Populism: [3,3,2,1] }
                    },
                    {
                        q: "How should wealth be distributed in society?",
                        options: ["Equal distribution", "Based on need", "Merit-based", "Market-determined"],
                        weights: { Communism: [4,4,0,0], Socialism: [3,4,2,0], Liberalism: [1,2,3,2], Conservatism: [0,1,4,3], Libertarianism: [0,0,2,4], Fascism: [2,2,3,1], Anarchism: [3,3,1,1], 'Social Democracy': [2,3,3,1], Neoliberalism: [0,0,3,4], Populism: [3,2,2,1] }
                    },
                    {
                        q: "What is your view on private property?",
                        options: ["Should be abolished", "Heavily regulated", "Protected with limits", "Absolute right"],
                        weights: { Communism: [4,2,0,0], Socialism: [3,3,1,0], Liberalism: [0,2,4,2], Conservatism: [0,1,3,4], Libertarianism: [0,0,1,4], Fascism: [2,3,2,1], Anarchism: [4,1,0,0], 'Social Democracy': [0,3,4,1], Neoliberalism: [0,0,2,4], Populism: [2,3,3,1] }
                    },
                    {
                        q: "How should society handle inequality?",
                        options: ["Eliminate completely", "Reduce significantly", "Accept some inequality", "Inequality is natural"],
                        weights: { Communism: [4,3,0,0], Socialism: [4,4,1,0], Liberalism: [2,3,3,1], Conservatism: [0,1,3,4], Libertarianism: [0,0,2,4], Fascism: [1,2,3,2], Anarchism: [4,2,1,0], 'Social Democracy': [3,4,2,0], Neoliberalism: [0,1,3,3], Populism: [3,3,2,1] }
                    },
                    {
                        q: "What is the ideal size of government?",
                        options: ["Large and powerful", "Moderate size", "Small government", "No government"],
                        weights: { Communism: [4,2,0,0], Socialism: [4,3,0,0], Liberalism: [2,4,2,0], Conservatism: [1,2,4,1], Libertarianism: [0,0,3,4], Fascism: [4,2,1,0], Anarchism: [0,0,1,4], 'Social Democracy': [3,4,1,0], Neoliberalism: [0,2,4,2], Populism: [3,3,2,0] }
                    },
                    {
                        q: "How should healthcare be provided?",
                        options: ["Universal state system", "Mixed public-private", "Mostly private", "Pure market system"],
                        weights: { Communism: [4,2,0,0], Socialism: [4,3,1,0], Liberalism: [3,4,2,1], Conservatism: [1,2,4,3], Libertarianism: [0,0,2,4], Fascism: [4,2,1,0], Anarchism: [2,1,1,2], 'Social Democracy': [4,4,1,0], Neoliberalism: [0,1,3,4], Populism: [4,2,1,0] }
                    },
                    {
                        q: "What is your view on traditional values?",
                        options: ["Reject completely", "Modernize gradually", "Preserve important ones", "Strictly maintain"],
                        weights: { Communism: [3,2,1,0], Socialism: [2,3,2,0], Liberalism: [1,3,3,1], Conservatism: [0,1,3,4], Libertarianism: [1,2,3,2], Fascism: [1,1,2,4], Anarchism: [4,2,1,0], 'Social Democracy': [1,3,3,1], Neoliberalism: [0,2,3,2], Populism: [1,2,3,3] }
                    },
                    {
                        q: "How should education be organized?",
                        options: ["State-controlled", "Public with standards", "Mixed system", "Private market"],
                        weights: { Communism: [4,3,1,0], Socialism: [4,4,2,0], Liberalism: [2,4,3,1], Conservatism: [1,3,3,2], Libertarianism: [0,1,2,4], Fascism: [4,3,1,0], Anarchism: [0,2,2,3], 'Social Democracy': [3,4,3,0], Neoliberalism: [0,2,3,4], Populism: [3,3,2,1] }
                    },
                    {
                        q: "What is the best approach to immigration?",
                        options: ["Open borders", "Regulated but welcoming", "Strict controls", "Closed borders"],
                        weights: { Communism: [2,3,1,0], Socialism: [3,4,1,0], Liberalism: [3,4,2,0], Conservatism: [0,1,4,3], Libertarianism: [4,2,1,1], Fascism: [0,0,2,4], Anarchism: [4,3,0,0], 'Social Democracy': [2,4,2,0], Neoliberalism: [2,3,3,1], Populism: [1,1,3,3] }
                    },
                    {
                        q: "How should environmental issues be addressed?",
                        options: ["Central planning", "Strong regulation", "Market solutions", "Individual choice"],
                        weights: { Communism: [4,3,0,0], Socialism: [3,4,1,0], Liberalism: [1,4,3,1], Conservatism: [0,2,3,3], Libertarianism: [0,0,3,4], Fascism: [3,3,1,0], Anarchism: [1,2,2,3], 'Social Democracy': [2,4,2,1], Neoliberalism: [0,1,4,2], Populism: [2,3,2,2] }
                    },
                    {
                        q: "What is your view on worker rights?",
                        options: ["Worker ownership", "Strong unions", "Basic protections", "Market freedom"],
                        weights: { Communism: [4,4,1,0], Socialism: [4,4,2,0], Liberalism: [2,3,4,1], Conservatism: [0,2,3,3], Libertarianism: [0,1,2,4], Fascism: [2,3,3,1], Anarchism: [4,3,1,1], 'Social Democracy': [3,4,3,0], Neoliberalism: [0,1,3,4], Populism: [3,4,2,1] }
                    },
                    {
                        q: "How should international relations be conducted?",
                        options: ["Global cooperation", "Multilateral approach", "National interest first", "Complete isolation"],
                        weights: { Communism: [4,3,1,0], Socialism: [4,4,1,0], Liberalism: [3,4,2,0], Conservatism: [1,2,4,2], Libertarianism: [2,2,3,3], Fascism: [0,1,4,2], Anarchism: [3,2,1,2], 'Social Democracy': [4,4,1,0], Neoliberalism: [3,4,3,1], Populism: [1,2,4,1] }
                    },
                    {
                        q: "What role should religion play in politics?",
                        options: ["No role at all", "Personal matter only", "Some influence", "Central role"],
                        weights: { Communism: [4,3,0,0], Socialism: [3,4,1,0], Liberalism: [2,4,3,1], Conservatism: [0,1,3,4], Libertarianism: [3,4,2,1], Fascism: [1,1,2,3], Anarchism: [4,3,1,0], 'Social Democracy': [2,4,2,1], Neoliberalism: [2,3,3,2], Populism: [1,2,3,3] }
                    },
                    {
                        q: "How should technology be regulated?",
                        options: ["State control", "Public oversight", "Light regulation", "No regulation"],
                        weights: { Communism: [4,3,1,0], Socialism: [3,4,2,0], Liberalism: [1,3,4,2], Conservatism: [1,2,4,2], Libertarianism: [0,0,2,4], Fascism: [4,2,1,0], Anarchism: [0,1,2,4], 'Social Democracy': [2,4,3,1], Neoliberalism: [0,1,4,3], Populism: [2,3,3,1] }
                    },
                    {
                        q: "What is the best path to social change?",
                        options: ["Revolution", "Democratic reform", "Gradual evolution", "Preserve status quo"],
                        weights: { Communism: [4,2,1,0], Socialism: [2,4,2,0], Liberalism: [0,4,3,1], Conservatism: [0,1,2,4], Libertarianism: [1,2,3,2], Fascism: [3,2,1,2], Anarchism: [4,1,1,0], 'Social Democracy': [0,4,3,1], Neoliberalism: [0,2,4,2], Populism: [2,3,2,1] }
                    }
                ]
            },
            philosophical: {
                name: "Philosophical Ideology",
                ideologies: [
                    'Nihilism', 'Existentialism', 'Hedonism', 'Stoicism', 'Utilitarianism',
                    'Absurdism', 'Humanism', 'Determinism', 'Relativism', 'Pragmatism'
                ],
                questions: [
                    {
                        q: "What is the meaning of life?",
                        options: ["Life has no inherent meaning", "We create our own meaning", "Pleasure and happiness", "Virtue and wisdom"],
                        weights: { Nihilism: [4,1,0,0], Existentialism: [2,4,1,2], Hedonism: [0,1,4,0], Stoicism: [1,2,1,4], Utilitarianism: [0,2,3,2], Absurdism: [3,4,1,1], Humanism: [0,3,2,3], Determinism: [3,1,1,2], Relativism: [2,4,2,2], Pragmatism: [1,3,2,3] }
                    },
                    {
                        q: "How should we deal with suffering?",
                        options: ["Accept it as meaningless", "Find meaning in it", "Avoid it at all costs", "Accept it with grace"],
                        weights: { Nihilism: [4,1,2,1], Existentialism: [1,4,1,2], Hedonism: [2,0,4,0], Stoicism: [1,2,0,4], Utilitarianism: [1,2,3,2], Absurdism: [3,3,2,2], Humanism: [0,3,2,3], Determinism: [3,2,1,3], Relativism: [2,3,2,3], Pragmatism: [1,2,3,3] }
                    },
                    {
                        q: "What drives human behavior?",
                        options: ["Nothing ultimately matters", "Free will and choice", "Pursuit of pleasure", "Rational thought"],
                        weights: { Nihilism: [4,0,1,1], Existentialism: [1,4,1,2], Hedonism: [1,2,4,0], Stoicism: [0,2,0,4], Utilitarianism: [0,1,2,4], Absurdism: [3,3,2,1], Humanism: [0,3,2,4], Determinism: [2,0,1,3], Relativism: [2,3,3,2], Pragmatism: [0,2,2,4] }
                    },
                    {
                        q: "How should we make moral decisions?",
                        options: ["Morality is illusion", "Personal authenticity", "Maximum pleasure", "Universal principles"],
                        weights: { Nihilism: [4,1,1,0], Existentialism: [1,4,0,2], Hedonism: [1,1,4,0], Stoicism: [0,1,0,4], Utilitarianism: [0,0,3,4], Absurdism: [3,3,1,1], Humanism: [0,2,1,4], Determinism: [3,1,1,2], Relativism: [3,4,2,1], Pragmatism: [0,2,2,3] }
                    },
                    {
                        q: "What is the nature of truth?",
                        options: ["Truth doesn't exist", "Subjective experience", "What feels good", "Objective reality"],
                        weights: { Nihilism: [4,2,0,1], Existentialism: [1,4,0,2], Hedonism: [1,2,4,1], Stoicism: [0,1,0,4], Utilitarianism: [0,1,1,4], Absurdism: [3,4,1,2], Humanism: [0,2,1,4], Determinism: [1,1,0,4], Relativism: [3,4,2,1], Pragmatism: [0,2,1,4] }
                    },
                    {
                        q: "How should we view death?",
                        options: ["Ultimate meaninglessness", "Final freedom", "End of pleasure", "Natural conclusion"],
                        weights: { Nihilism: [4,2,1,2], Existentialism: [2,4,1,3], Hedonism: [2,1,4,1], Stoicism: [1,2,0,4], Utilitarianism: [1,1,2,3], Absurdism: [3,4,2,3], Humanism: [1,2,1,4], Determinism: [3,2,1,4], Relativism: [2,3,2,3], Pragmatism: [1,2,2,4] }
                    },
                    {
                        q: "What is the role of emotions?",
                        options: ["Meaningless reactions", "Authentic expression", "Sources of pleasure", "To be controlled"],
                        weights: { Nihilism: [4,1,1,2], Existentialism: [1,4,2,1], Hedonism: [0,2,4,0], Stoicism: [1,1,1,4], Utilitarianism: [1,1,3,3], Absurdism: [2,4,3,2], Humanism: [0,4,2,2], Determinism: [3,2,1,3], Relativism: [1,4,3,2], Pragmatism: [0,2,3,3] }
                    },
                    {
                        q: "How should we approach knowledge?",
                        options: ["All knowledge is futile", "Through experience", "What brings joy", "Through reason"],
                        weights: { Nihilism: [4,1,0,1], Existentialism: [1,4,1,2], Hedonism: [1,2,4,1], Stoicism: [0,2,0,4], Utilitarianism: [0,2,1,4], Absurdism: [3,3,2,2], Humanism: [0,3,1,4], Determinism: [2,1,0,4], Relativism: [2,4,2,2], Pragmatism: [0,4,1,3] }
                    },
                    {
                        q: "What is the best way to live?",
                        options: ["Nothing matters anyway", "Authentically", "Maximize pleasure", "With virtue"],
                        weights: { Nihilism: [4,0,1,0], Existentialism: [1,4,1,2], Hedonism: [0,1,4,0], Stoicism: [0,1,0,4], Utilitarianism: [0,1,4,2], Absurdism: [3,4,2,1], Humanism: [0,3,2,4], Determinism: [3,1,1,2], Relativism: [2,4,3,2], Pragmatism: [0,3,3,4] }
                    },
                    {
                        q: "How do you view human nature?",
                        options: ["Fundamentally empty", "Self-creating", "Pleasure-seeking", "Rational beings"],
                        weights: { Nihilism: [4,1,2,1], Existentialism: [1,4,1,2], Hedonism: [1,1,4,1], Stoicism: [0,1,1,4], Utilitarianism: [0,1,3,3], Absurdism: [3,4,2,2], Humanism: [0,2,2,4], Determinism: [2,0,2,3], Relativism: [2,4,3,2], Pragmatism: [0,2,2,4] }
                    },
                    {
                        q: "What is your view on progress?",
                        options: ["Illusion of progress", "Individual growth", "More happiness", "Rational advancement"],
                        weights: { Nihilism: [4,1,1,1], Existentialism: [2,4,1,2], Hedonism: [1,2,4,1], Stoicism: [2,2,1,3], Utilitarianism: [0,1,4,4], Absurdism: [4,3,2,2], Humanism: [0,3,3,4], Determinism: [3,1,1,3], Relativism: [3,3,3,2], Pragmatism: [0,2,3,4] }
                    },
                    {
                        q: "How should we handle uncertainty?",
                        options: ["Embrace the void", "Create meaning despite it", "Seek comfort", "Accept with wisdom"],
                        weights: { Nihilism: [4,2,1,2], Existentialism: [2,4,0,2], Hedonism: [1,1,4,1], Stoicism: [1,1,1,4], Utilitarianism: [1,2,2,3], Absurdism: [4,4,1,2], Humanism: [1,3,2,3], Determinism: [3,1,1,4], Relativism: [3,4,2,2], Pragmatism: [1,3,2,4] }
                    },
                    {
                        q: "What is the source of values?",
                        options: ["No real source", "Individual choice", "What feels good", "Universal reason"],
                        weights: { Nihilism: [4,1,1,0], Existentialism: [1,4,0,1], Hedonism: [1,1,4,0], Stoicism: [0,1,0,4], Utilitarianism: [0,0,2,4], Absurdism: [3,4,2,1], Humanism: [0,3,1,4], Determinism: [3,0,1,2], Relativism: [3,4,3,1], Pragmatism: [0,3,2,3] }
                    },
                    {
                        q: "How do you view responsibility?",
                        options: ["We have none", "Total responsibility", "For our happiness", "Duty to virtue"],
                        weights: { Nihilism: [4,0,1,0], Existentialism: [0,4,1,2], Hedonism: [1,1,4,0], Stoicism: [0,2,0,4], Utilitarianism: [0,1,2,4], Absurdism: [3,4,2,1], Humanism: [0,3,2,4], Determinism: [4,0,1,2], Relativism: [2,3,3,2], Pragmatism: [0,2,2,4] }
                    },
                    {
                        q: "What is your approach to change?",
                        options: ["Nothing changes meaning", "Constant self-creation", "Adapt for pleasure", "Accept what you can't control"],
                        weights: { Nihilism: [4,1,1,2], Existentialism: [1,4,1,1], Hedonism: [1,2,4,1], Stoicism: [1,1,1,4], Utilitarianism: [0,2,3,2], Absurdism: [3,4,2,2], Humanism: [0,3,2,3], Determinism: [4,0,1,3], Relativism: [2,4,3,2], Pragmatism: [0,3,4,3] }
                    }
                ]
            }
        };
    }
    
    bindEvents() {
        // Test selection buttons
        document.querySelector('.politics').addEventListener('click', () => this.startTest('political'));
        document.querySelector('.psychology').addEventListener('click', () => this.startTest('philosophical'));
        
        // Navigation buttons
        this.elements.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.elements.prevBtn.addEventListener('click', () => this.previousQuestion());
        this.elements.submitBtn.addEventListener('click', () => this.submitTest());
        
        // Restart button
        document.querySelector('.restart').addEventListener('click', () => this.restart());
        
        // Option buttons
        this.elements.options.forEach((btn, index) => {
            btn.addEventListener('click', () => this.selectOption(index));
        });
    }
    
    showHome() {
        this.hideAll();
        this.elements.home.style.display = 'block';
        // Hide progress bar on home screen
        document.querySelector('.progress').style.display = 'none';
    }
    
    hideAll() {
        [this.elements.home, this.elements.test, 
         this.elements.loading, this.elements.result].forEach(el => {
            el.style.display = 'none';
        });
    }
    
    startTest(testType) {
        this.currentTest = testType;
        this.currentQuestion = 0;
        this.answers = [];
        this.scores = {};
        
        // Initialize scores
        this.tests[testType].ideologies.forEach(ideology => {
            this.scores[ideology] = 0;
        });
        
        this.showLoading('test');
        setTimeout(() => {
            this.showTest();
            this.loadQuestion();
        }, 1500);
    }
    
    showLoading(type = 'test') {
        this.hideAll();
        this.elements.loading.style.display = 'block';
        
        // Update loading text based on type
        const loadingText = this.elements.loading.querySelector('.loading-text');
        if (loadingText) {
            if (type === 'test') {
                loadingText.textContent = `Loading ${this.tests[this.currentTest].name}...`;
            } else if (type === 'result') {
                loadingText.textContent = 'Calculating your results...';
            }
        }
    }
    
    showTest() {
        this.hideAll();
        this.elements.test.style.display = 'block';
        this.elements.control.classList.remove('active');
        this.elements.control.classList.add('active');

        
        // Show progress bar only during test
        document.querySelector('.progress').style.display = 'block';
        this.elements.totalQ.textContent = this.tests[this.currentTest].questions.length;
    }
    
    loadQuestion() {
        const test = this.tests[this.currentTest];
        const question = test.questions[this.currentQuestion];
        
        // Update question text
        this.elements.question.textContent = question.q;
        
        // Update options
        this.elements.options.forEach((btn, index) => {
            btn.textContent = question.options[index];
            btn.classList.remove('selected');
        });
        
        // Restore previous answer if exists
        if (this.answers[this.currentQuestion] !== undefined) {
            this.elements.options[this.answers[this.currentQuestion]].classList.add('selected');
        }
        
        // Update progress
        this.updateProgress();
        
        // Update button visibility
        this.updateButtons();
    }
    
    selectOption(optionIndex) {
        // Clear previous selection
        this.elements.options.forEach(btn => btn.classList.remove('selected'));
        
        // Select new option
        this.elements.options[optionIndex].classList.add('selected');
        
        // Store answer
        this.answers[this.currentQuestion] = optionIndex;
    }
    
    nextQuestion() {
        if (this.answers[this.currentQuestion] === undefined) {
            alert('Please select an answer before proceeding.');
            return;
        }
        
        if (this.currentQuestion < this.tests[this.currentTest].questions.length - 1) {
            this.currentQuestion++;
            this.loadQuestion();
        }
    }
    
    previousQuestion() {
        if (this.currentQuestion > 0) {
            this.currentQuestion--;
            this.loadQuestion();
        }
    }
    
    updateProgress() {
        this.elements.currentQ.textContent = this.currentQuestion + 1;
        const progress = ((this.currentQuestion + 1) / this.tests[this.currentTest].questions.length) * 100;
        this.elements.progressFill.style.width = progress + '%';
    }
    
    updateButtons() {
        const isLastQuestion = this.currentQuestion === this.tests[this.currentTest].questions.length - 1;
        const isFirstQuestion = this.currentQuestion === 0;
        
        this.elements.prevBtn.style.display = isFirstQuestion ? 'none' : 'flex';
        this.elements.nextBtn.style.display = isLastQuestion ? 'none' : 'flex';
        this.elements.submitBtn.style.display = isLastQuestion ? 'flex' : 'none';
    }
    
    submitTest() {
        if (this.answers[this.currentQuestion] === undefined) {
            alert('Please answer the current question before submitting.');
            return;
        }
        
        // Show loading for result calculation
        this.showLoading('result');
        
        // Calculate scores with delay to show loading
        setTimeout(() => {
            this.calculateScores();
            this.showResult();
        }, 2000);
    }
    
    calculateScores() {
        const test = this.tests[this.currentTest];
        
        this.answers.forEach((answerIndex, questionIndex) => {
            const question = test.questions[questionIndex];
            
            test.ideologies.forEach(ideology => {
                const weight = question.weights[ideology][answerIndex];
                this.scores[ideology] += weight;
            });
        });
    }
    
    showResult() {
        this.hideAll();
        this.elements.result.style.display = 'block';
        
        // Hide progress bar on result screen
        document.querySelector('.progress').style.display = 'none';
        
        // Find highest scoring ideology
        const maxScore = Math.max(...Object.values(this.scores));
        const topIdeology = Object.keys(this.scores).find(ideology => this.scores[ideology] === maxScore);
        
        // Display result
        this.elements.resultTitle.textContent = `Your Result: ${topIdeology}`;
        this.elements.resultDesc.innerHTML = this.getIdeologyDescription(topIdeology) + 
            '<br><br><strong>Score Breakdown:</strong><br>' +
            Object.entries(this.scores)
                .sort((a, b) => b[1] - a[1])
                .map(([ideology, score]) => `${ideology}: ${score}`)
                .join('<br>');
    }
    
    getIdeologyDescription(ideology) {
        const descriptions = {
            // Political ideologies
            'Communism': 'A socio-economic system advocating for collective ownership and a classless society.',
            'Socialism': 'An economic system emphasizing social ownership and democratic control of production.',
            'Liberalism': 'A political philosophy emphasizing individual rights, democracy, and free markets.',
            'Conservatism': 'A political philosophy emphasizing tradition, social stability, and gradual change.',
            'Libertarianism': 'A political philosophy maximizing individual liberty and minimizing government intervention.',
            'Fascism': 'An authoritarian ultranationalist political ideology characterized by dictatorial power.',
            'Anarchism': 'A political philosophy advocating for the abolition of all involuntary government.',
            'Social Democracy': 'A political ideology supporting democratic governance with social justice policies.',
            'Neoliberalism': 'An economic philosophy emphasizing free markets, deregulation, and privatization.',
            'Populism': 'A political approach appealing to ordinary people against established elites.',
            
            // Philosophical ideologies
            'Nihilism': 'The belief that life is without objective meaning, purpose, or intrinsic value.',
            'Existentialism': 'A philosophy emphasizing individual existence, freedom, and the creation of meaning.',
            'Hedonism': 'The pursuit of pleasure and happiness as the primary goal of human life.',
            'Stoicism': 'A philosophy of personal ethics informed by logic and focused on virtue and wisdom.',
            'Utilitarianism': 'An ethical theory that determines right from wrong by focusing on outcomes and the greatest good.',
            'Absurdism': 'The belief that human efforts to find meaning will ultimately fail due to the absurd nature of existence.',
            'Humanism': 'A philosophical stance emphasizing the value and agency of human beings.',
            'Determinism': 'The doctrine that all events are the result of previously existing causes.',
            'Relativism': 'The idea that points of view have no absolute truth or validity within themselves.',
            'Pragmatism': 'A philosophical tradition that considers practical consequences as the criteria of truth and meaning.'
        };
        
        return descriptions[ideology] || 'A unique ideological perspective.';
    }
    
    restart() {
        this.currentTest = null;
        this.currentQuestion = 0;
        this.answers = [];
        this.scores = {};
        this.showHome();
    }
}

// Initialize the test when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new IdeologyTest();
});